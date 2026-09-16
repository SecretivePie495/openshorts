"""The SSRF guard itself (security_utils.assert_public_url).

Every other test that touches this monkeypatches it into a no-op — sensibly,
since they are testing download plans rather than the guard — but that left the
app's only SSRF defense with no test of its own: a regression in it would ship
green. These call the real thing, with DNS stubbed so they neither need the
network nor depend on what a name resolves to today.

The guard matters because the app fetches user-supplied URLs server-side
(yt-dlp, landing-page scraping, actor-image download), so a caller who can
choose the host can otherwise read cloud instance credentials off
169.254.169.254.
"""
import socket

import pytest

security_utils = pytest.importorskip("security_utils")

assert_public_url = security_utils.assert_public_url
UnsafeURLError = security_utils.UnsafeURLError


@pytest.fixture()
def resolves_to(monkeypatch):
    """Point every hostname at the addresses a test names."""
    def _install(*addresses):
        def fake_getaddrinfo(host, port, *a, **k):
            return [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "",
                     (addr, port or 0)) for addr in addresses]
        monkeypatch.setattr(security_utils.socket, "getaddrinfo", fake_getaddrinfo)
    return _install


class TestPublicHostsPass:
    def test_a_public_literal(self):
        assert assert_public_url("https://8.8.8.8/video.mp4")

    def test_a_name_resolving_somewhere_public(self, resolves_to):
        resolves_to("93.184.216.34")
        assert assert_public_url("https://example.com/video.mp4")

    def test_http_as_well_as_https(self, resolves_to):
        resolves_to("93.184.216.34")
        assert assert_public_url("http://example.com/video.mp4")


class TestTheMetadataEndpoint:
    """169.254.169.254 is the whole reason this function exists."""

    def test_as_a_literal(self):
        with pytest.raises(UnsafeURLError):
            assert_public_url("http://169.254.169.254/latest/meta-data/")

    def test_behind_a_hostname(self, resolves_to):
        # A name the attacker controls, pointed at the metadata address — the
        # case a scheme/literal check alone would wave through.
        resolves_to("169.254.169.254")
        with pytest.raises(UnsafeURLError):
            assert_public_url("https://totally-normal.example.com/video.mp4")


class TestPrivateRangesAreRefused:
    @pytest.mark.parametrize("url", [
        "http://127.0.0.1:8000/api/me",
        "http://localhost:8000/api/me",
        "http://10.0.0.5/internal",
        "http://192.168.1.1/",
        "http://172.16.0.1/",
        "http://[::1]:6379/",
        "http://0.0.0.0/",
    ])
    def test_literals(self, url, resolves_to):
        resolves_to("127.0.0.1")  # for the one name in the list
        with pytest.raises(UnsafeURLError):
            assert_public_url(url)

    def test_a_name_resolving_into_a_private_range(self, resolves_to):
        resolves_to("10.1.2.3")
        with pytest.raises(UnsafeURLError):
            assert_public_url("https://intranet.example.com/")

    def test_one_bad_answer_among_good_ones_is_enough(self, resolves_to):
        # DNS rebinding shape: refuse if ANY record is non-public, rather than
        # trusting whichever address happens to come back first.
        resolves_to("93.184.216.34", "127.0.0.1")
        with pytest.raises(UnsafeURLError):
            assert_public_url("https://rebind.example.com/")


class TestNonHttpSchemes:
    @pytest.mark.parametrize("url", [
        "file:///etc/passwd",
        "gopher://example.com/",
        "ftp://example.com/x.mp4",
        "data:text/plain;base64,aGk=",
        "javascript:alert(1)",
    ])
    def test_refused(self, url):
        with pytest.raises(UnsafeURLError):
            assert_public_url(url)


class TestMalformedInput:
    @pytest.mark.parametrize("url", ["", None, "https://", "not a url", 42])
    def test_refused(self, url):
        with pytest.raises(UnsafeURLError):
            assert_public_url(url)

    def test_a_name_that_does_not_resolve(self, monkeypatch):
        def boom(*a, **k):
            raise socket.gaierror("nope")
        monkeypatch.setattr(security_utils.socket, "getaddrinfo", boom)
        with pytest.raises(UnsafeURLError):
            assert_public_url("https://nx.example.com/")
