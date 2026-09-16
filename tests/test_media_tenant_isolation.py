"""Who may fetch the /videos and /thumbnails bytes.

test_media_path_guard covers WHAT kind of file may leave; this covers WHOSE it
has to be. Until now nothing checked: media_auth shipped both token shapes and
``app.py`` imported exactly one function from it — the extension allowlist — so
a leaked job id (they travel in every clip URL, referrer header and shared
screenshot) bought permanent unauthenticated access to another tenant's clips,
source video and face crops.

Enforcement sits behind MEDIA_AUTH_ENABLED because it only works once the
dashboard appends ?mt= to media URLs; the default-off tests below are what keep
an older frontend from going dark on deploy.
"""
import asyncio

import pytest

media_auth = pytest.importorskip("media_auth")
app_module = pytest.importorskip("app")

SECRET = "test-media-secret"
OWNER = "11111111-1111-1111-1111-111111111111"
STRANGER = "22222222-2222-2222-2222-222222222222"
REL = "job-abc/clip_1.mp4"


def _scope(query: str = "", headers=None):
    return {
        "type": "http",
        "method": "GET",
        "path": f"/videos/{REL}",
        "query_string": query.encode(),
        "headers": headers or [],
    }


def _authorized(kind="videos", rel=REL, query=""):
    return asyncio.run(app_module._media_authorized(kind, rel, _scope(query)))


@pytest.fixture()
def enforcing(monkeypatch):
    """Cloud mode with the flag on and one owned job in memory."""
    monkeypatch.setattr(app_module, "BILLING_ENABLED", True)
    monkeypatch.setattr(app_module, "MEDIA_AUTH_ENABLED", True)
    monkeypatch.setattr(app_module, "_media_secret", lambda: SECRET)
    monkeypatch.setitem(app_module.jobs, "job-abc", {"user_id": OWNER})

    async def _nobody(request):
        return None

    monkeypatch.setattr(app_module, "_user_from_request", _nobody)


def _as_user(monkeypatch, uid):
    class _User:
        id = uid

    async def _resolve(request):
        return _User()

    monkeypatch.setattr(app_module, "_user_from_request", _resolve)


class TestTheGuardsAreWiredIn:
    def _mount(self, name):
        return next(r for r in app_module.app.routes
                    if getattr(r, "name", None) == name)

    @pytest.mark.parametrize("name", ["videos", "thumbnails"])
    def test_both_mounts_check_ownership(self, name):
        assert self._mount(name).app.authorizer is not None, \
            f"/{name} serves its bytes to anyone holding the id"

    @pytest.mark.parametrize("name", ["videos", "thumbnails"])
    def test_both_mounts_carry_the_allowlist(self, name):
        # /thumbnails was a bare StaticFiles: no allowlist at all.
        assert self._mount(name).app.guard is media_auth.is_servable


class TestDefaultsStayOpen:
    """The flag is the thing standing between a deploy and every player 404ing."""

    def test_disabled_by_default(self):
        assert app_module.MEDIA_AUTH_ENABLED is False

    def test_flag_off_serves_everything(self, monkeypatch):
        monkeypatch.setattr(app_module, "BILLING_ENABLED", True)
        monkeypatch.setattr(app_module, "MEDIA_AUTH_ENABLED", False)
        assert _authorized() is True

    def test_self_host_is_never_checked(self, monkeypatch):
        # No tenants to separate, and no secret to sign with.
        monkeypatch.setattr(app_module, "BILLING_ENABLED", False)
        monkeypatch.setattr(app_module, "MEDIA_AUTH_ENABLED", True)
        assert _authorized() is True

    def test_an_unowned_job_stays_public(self, enforcing, monkeypatch):
        # BYOK and anonymous jobs never stamp an owner; refusing them would
        # break the very users who have no account to prove anything with.
        monkeypatch.setitem(app_module.jobs, "job-abc", {})
        assert _authorized() is True


class TestStrangersAreRefused:
    def test_no_credentials_at_all(self, enforcing):
        assert _authorized() is False

    def test_another_users_media_token(self, enforcing):
        token = media_auth.mint_user_token(STRANGER, SECRET)
        assert _authorized(query=f"mt={token}") is False

    def test_a_token_signed_with_the_wrong_secret(self, enforcing):
        token = media_auth.mint_user_token(OWNER, "not-the-secret")
        assert _authorized(query=f"mt={token}") is False

    def test_an_expired_token(self, enforcing):
        token = media_auth.mint_user_token(OWNER, SECRET, ttl=-10)
        assert _authorized(query=f"mt={token}") is False

    def test_a_signature_minted_for_a_different_path(self, enforcing):
        signed = media_auth.sign_media_url("/videos/job-abc/other.mp4", SECRET)
        assert _authorized(query=signed.split("?", 1)[1]) is False

    def test_a_signed_in_stranger(self, enforcing, monkeypatch):
        _as_user(monkeypatch, STRANGER)
        assert _authorized() is False


class TestTheOwnerGetsIn:
    def test_their_own_media_token(self, enforcing):
        token = media_auth.mint_user_token(OWNER, SECRET)
        assert _authorized(query=f"mt={token}") is True

    def test_a_signed_url_for_this_exact_path(self, enforcing):
        # What the webhook payload and the MCP tools hand out: no header, no
        # session, just a capability for one path.
        signed = media_auth.sign_media_url(f"/videos/{REL}", SECRET)
        assert _authorized(query=signed.split("?", 1)[1]) is True

    def test_an_ordinary_auth_header(self, enforcing, monkeypatch):
        # Agents and curl resolve through the normal dependency instead.
        _as_user(monkeypatch, OWNER)
        assert _authorized() is True


class TestOwnershipSurvivesARestart:
    def test_the_sidecar_is_consulted_when_memory_is_empty(
            self, enforcing, monkeypatch, tmp_path):
        """A redeploy drops the in-memory record but leaves .owner on disk; the
        job must not become public by surviving one."""
        monkeypatch.delitem(app_module.jobs, "job-abc")
        job_dir = tmp_path / "job-abc"
        job_dir.mkdir()
        (job_dir / ".owner").write_text(OWNER + "\n")
        monkeypatch.setattr(app_module, "OUTPUT_DIR", str(tmp_path))

        assert _authorized() is False
        token = media_auth.mint_user_token(OWNER, SECRET)
        assert _authorized(query=f"mt={token}") is True

    def test_a_job_with_no_sidecar_stays_public(
            self, enforcing, monkeypatch, tmp_path):
        monkeypatch.delitem(app_module.jobs, "job-abc")
        monkeypatch.setattr(app_module, "OUTPUT_DIR", str(tmp_path))
        assert _authorized() is True


class TestOverRealHttp:
    """The unit tests above pin the decision; this drives the actual mount, so
    a wrong answer shows up as the status code a browser would really see."""

    @pytest.fixture()
    def client(self, enforcing, tmp_path):
        import httpx
        from starlette.applications import Starlette
        from starlette.routing import Mount

        from restoring_static import RestoringStaticFiles

        job_dir = tmp_path / "job-abc"
        job_dir.mkdir()
        (job_dir / "clip_1.mp4").write_bytes(b"the clip bytes")
        (job_dir / ".owner").write_text(OWNER)

        mount = RestoringStaticFiles(
            directory=str(tmp_path),
            guard=media_auth.is_servable,
            authorizer=lambda rel, scope: app_module._media_authorized(
                "videos", rel, scope),
        )
        return httpx.AsyncClient(
            transport=httpx.ASGITransport(
                app=Starlette(routes=[Mount("/videos", app=mount)])),
            base_url="http://testserver")

    def _get(self, client, url):
        async def _do():
            async with client as c:
                return await c.get(url)
        return asyncio.run(_do())

    def test_a_stranger_gets_404_not_the_clip(self, client):
        res = self._get(client, f"/videos/{REL}")
        assert res.status_code == 404
        assert b"the clip bytes" not in res.content

    def test_the_owner_gets_the_bytes(self, client):
        token = media_auth.mint_user_token(OWNER, SECRET)
        res = self._get(client, f"/videos/{REL}?mt={token}")
        assert res.status_code == 200
        assert res.content == b"the clip bytes"

    def test_the_owner_sidecar_is_still_never_served(self, client):
        # The allowlist runs first, so even the owner cannot read it.
        token = media_auth.mint_user_token(OWNER, SECRET)
        assert self._get(
            client, f"/videos/job-abc/.owner?mt={token}").status_code == 404


class TestThumbnailSessions:
    def test_a_stranger_cannot_read_someone_elses_face_crops(
            self, enforcing, monkeypatch):
        monkeypatch.setitem(app_module.thumbnail_sessions,
                            "sess-1", {"user_id": OWNER})
        assert _authorized(kind="thumbnails", rel="sess-1/face_0.jpg") is False

    def test_the_owner_can(self, enforcing, monkeypatch):
        monkeypatch.setitem(app_module.thumbnail_sessions,
                            "sess-1", {"user_id": OWNER})
        token = media_auth.mint_user_token(OWNER, SECRET)
        assert _authorized(kind="thumbnails", rel="sess-1/face_0.jpg",
                           query=f"mt={token}") is True
