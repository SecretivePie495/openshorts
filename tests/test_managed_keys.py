"""Who gets a server-owned provider key (cloud/managed_keys.py).

Small, but it is the gate on billing: ``has_active_entitlement`` is what stands
between an unentitled account and the managed Gemini / Upload-Post keys the
company pays for. app.py's resolve helpers call it inline for every job, and it
had no test at all — a truthy default on the attribute, or the getattr losing
its fallback, would hand paid keys to everyone and nothing would notice.
"""
import types

import pytest

managed_keys = pytest.importorskip("cloud.managed_keys")


def _user(**attrs):
    return types.SimpleNamespace(**attrs)


class TestEntitlement:
    def test_an_entitled_user_passes(self):
        assert managed_keys.has_active_entitlement(_user(entitled=True)) is True

    def test_an_unentitled_user_does_not(self):
        assert managed_keys.has_active_entitlement(_user(entitled=False)) is False

    def test_anonymous_does_not(self):
        # Self-host and signed-out both arrive here as None.
        assert managed_keys.has_active_entitlement(None) is False

    def test_a_user_without_the_flag_fails_closed(self):
        # Never assume absence means yes: a shape that predates the flag, or a
        # partially built snapshot, must not read as entitled.
        assert managed_keys.has_active_entitlement(_user(id="u1")) is False

    @pytest.mark.parametrize("value", [0, "", None, [], "false"])
    def test_only_a_truthy_flag_counts(self, value):
        result = managed_keys.has_active_entitlement(_user(entitled=value))
        assert result is bool(value)
        assert result is not None


class TestKeyLookup:
    def test_configured_keys_are_returned(self, monkeypatch):
        # settings exposes these as properties reading the environment, so the
        # environment is the seam.
        monkeypatch.setenv("MANAGED_GEMINI_API_KEY", "gemini-secret")
        monkeypatch.setenv("MANAGED_UPLOAD_POST_API_KEY", "upload-secret")
        assert managed_keys.gemini_key() == "gemini-secret"
        assert managed_keys.upload_post_key() == "upload-secret"

    def test_unset_keys_are_none_not_empty_string(self, monkeypatch):
        # Callers branch on truthiness, and "" would read as "managed key
        # configured" to anything doing `is not None`.
        monkeypatch.delenv("MANAGED_GEMINI_API_KEY", raising=False)
        monkeypatch.delenv("MANAGED_UPLOAD_POST_API_KEY", raising=False)
        assert managed_keys.gemini_key() is None
        assert managed_keys.upload_post_key() is None
