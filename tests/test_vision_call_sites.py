"""The three vision stages consume gemini_worker.generate_with_capacity_chain,
which returns ``(parsed, winner)`` and parses INSIDE the retry loop through the
``validate`` callback.

Regression, all three at once: they used to bind the whole tuple to
``response`` and then read ``response.text`` — an AttributeError on a tuple.
Each one is wrapped in a try/except that degrades silently, so layout picking,
screencast detection and hook grounding fell back on EVERY video instead of
only on a real failure. Nothing caught it because the older tests stub these
functions out wholesale; these drive the real bodies.

They also pin the ``validate`` callback: without it a 200-with-empty-body
raises outside the retry loop and costs the stage its answer, which is the
whole reason the text pipeline passes one (prod 22-jul-2026).
"""
import json
import types

import pytest

import gemini_worker
import hook_grounding
import layout_picker
import screencast_layout


def chain_double(answer, seen):
    """Stand-in honouring the real contract: parse through ``validate``, then
    return ``(parsed, winner)`` — never a bare response."""

    def fake(client, model_name, *, contents, config=None, where="",
             budget=None, validate=None, sleep=None, now=None):
        seen["validate"] = validate
        seen["where"] = where
        response = types.SimpleNamespace(text=json.dumps(answer), parsed=None)
        return (validate(response) if validate else response), model_name

    return fake


@pytest.fixture
def seen():
    return {}


@pytest.fixture
def fake_genai(monkeypatch):
    """Neutralise the SDK client the call sites build before the chain runs."""
    from google import genai

    class FakeFiles:
        def upload(self, file=None):
            return types.SimpleNamespace(name="files/fake")

        def get(self, name=None):
            return types.SimpleNamespace(state=types.SimpleNamespace(name="ACTIVE"))

        def delete(self, name=None):
            return None

    class FakeClient:
        def __init__(self, *a, **k):
            self.files = FakeFiles()

    monkeypatch.setattr(genai, "Client", FakeClient)


def test_layout_picker_reads_the_pick(monkeypatch, seen, fake_genai):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(layout_picker, "ENABLED", True)
    monkeypatch.setattr(layout_picker, "sample_frames", lambda *a, **k: [b"jpg"])
    monkeypatch.setattr(gemini_worker, "generate_with_capacity_chain",
                        chain_double({"layout": "screencast", "why": "slides",
                                      "confidence": 0.9}, seen))

    assert layout_picker.pick("video.mp4", 120.0) == "screencast"
    assert seen["validate"] is not None, "an empty 200 body must cost a retry"


def test_hook_grounding_reads_the_rewrite(monkeypatch, seen, fake_genai):
    answer = {"on_screen": "a terminal", "viral_hook_text": "Watch this",
              "video_title_for_youtube_short": "Watch this"}
    monkeypatch.setattr(gemini_worker, "generate_with_capacity_chain",
                        chain_double(answer, seen))

    assert hook_grounding._ask_gemini([b"jpg"], "prompt", "test-key") == answer
    assert seen["validate"] is not None, "an empty 200 body must cost a retry"


def test_screencast_reads_the_ranges(monkeypatch, seen, fake_genai):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(screencast_layout, "ENABLED", True)
    monkeypatch.setattr(gemini_worker, "generate_with_capacity_chain",
                        chain_double({"ranges": [
                            {"start": 5, "end": 30, "what": "slides",
                             "width_fraction": 0.99}]}, seen))

    ranges = screencast_layout.detect_content_ranges("video.mp4", 120.0)
    assert [(s, e, w) for s, e, w, _ in ranges] == [(5.0, 30.0, "slides")]
    assert seen["validate"] is not None, "an empty 200 body must cost a retry"


def test_a_bare_response_would_be_caught():
    """The shape that used to ship: had the call sites kept reading
    ``response.text``, the tuple below is what they would have read it from."""
    out = gemini_worker.generate_with_capacity_chain(
        types.SimpleNamespace(models=types.SimpleNamespace(
            generate_content=lambda **k: types.SimpleNamespace(
                text='{"layout": "none"}', parsed=None))),
        "gemini-x", contents="p", validate=gemini_worker.parse_json_response)

    assert isinstance(out, tuple) and len(out) == 2
    with pytest.raises(AttributeError):
        out.text
