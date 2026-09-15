"""The download chain goes out anonymously first; cookies ride last.

With YOUTUBE_COOKIES attached, YouTube answers UNPLAYABLE for every client
on a share of videos (prod, 9-sep-2026: cookies -> "Video unavailable" on
all three statics; anonymous on the same IP -> 1080p). The account cookie
jar therefore never leads an attempt: every route runs without a cookiefile
and a single authed attempt follows the whole anonymous chain, on a free
route, for the age-gated/private content that genuinely needs a session.
"""
import sys
import types

import pytest

main = pytest.importorskip("main")

URL = "https://www.youtube.com/watch?v=e_04ZrNroTo"
NETSCAPE = "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tx\n"


def _fake_ytdl(monkeypatch, seen, fail_with_cookies=True):
    class _YDL:
        def __init__(self, opts):
            self.opts = opts

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def extract_info(self, url, download=False):
            entry = {"proxy": self.opts.get("proxy"),
                     "cookies": bool(self.opts.get("cookiefile"))}
            if self.opts.get("cookiefile") and fail_with_cookies:
                seen.append(entry)
                raise RuntimeError("ERROR: [youtube] Video unavailable")
            seen.append(entry)
            return {"title": "Anonymous First", "duration": 12}

        def download(self, urls):
            pass

    monkeypatch.setattr(main, "yt_dlp", types.SimpleNamespace(
        YoutubeDL=_YDL, version=types.SimpleNamespace(__version__="2026.01.01")))
    return _YDL


@pytest.fixture(autouse=True)
def _env(monkeypatch, tmp_path):
    import security_utils
    monkeypatch.setattr(security_utils, "assert_public_url", lambda u: u)
    monkeypatch.setenv("STATIC_PROXY_URLS", "http://s1,http://s2")
    monkeypatch.setenv("PROXY_URL", "http://paid")
    monkeypatch.setenv("YOUTUBE_COOKIES", NETSCAPE)
    monkeypatch.setenv("BGUTIL_BASE_URL", "http://127.0.0.1:4416")
    monkeypatch.delenv("BGUTIL_SCRIPT_PATH", raising=False)
    monkeypatch.delenv("DIRECT_FIRST", raising=False)
    yield


def test_anonymous_routes_lead_and_cookies_rides_last(monkeypatch, tmp_path):
    seen = []
    _fake_ytdl(monkeypatch, seen)
    path, title = main.download_youtube_video(URL, str(tmp_path))
    # Every anonymous attempt comes first; the single authed attempt is last.
    flags = [a["cookies"] for a in seen]
    assert flags == [False] * (len(flags) - 1) + [True]
    # It is free-route: never the per-GB proxy.
    assert seen[-1]["proxy"] in ("http://s1", "http://s2", None)
    assert title == "Anonymous First"


def test_healthy_video_never_reaches_the_cookie_attempt(monkeypatch, tmp_path):
    seen = []
    _fake_ytdl(monkeypatch, seen, fail_with_cookies=False)
    main.download_youtube_video(URL, str(tmp_path))
    assert all(a["cookies"] is False for a in seen)


def test_no_provider_selfhost_anonymous_then_operator_cookies(monkeypatch, tmp_path):
    seen = []
    # Anonymous fails everywhere: the operator's cookies must still get the
    # trailing shot (age-gated/private content), and only after every free
    # anonymous route has answered first.
    _fake_ytdl(monkeypatch, seen)
    monkeypatch.delenv("BGUTIL_BASE_URL", raising=False)
    monkeypatch.delenv("BGUTIL_SCRIPT_PATH", raising=False)
    main.download_youtube_video(URL, str(tmp_path))
    flags = [a["cookies"] for a in seen]
    assert flags[0] is False
    assert flags[-1] is True
    assert sum(flags) == 1
