"""Gemini stage retries must outlast a capacity spike, not a network blip.

Prod 15-sep-2026: a scoring call died after 3 attempts spread over 15s while
Google's own "high demand" 503 lasted minutes; resubmitting the same job once
the spike passed needed no code change. The policy now defaults to 6 attempts
with full jitter, capped at 90s (~7 min of coverage), tunable per deployment
with GEMINI_STAGE_RETRIES.

``main`` imports the ML stack at module level (mediapipe, ultralytics, torch,
scenedetect). Neither CI's slim env nor a bare dev box has it, and stubbing it
at import time would poison every other test that imports the real module in
the same session — so the stubs live in a context manager around the import
and are removed again before any assertion runs.
"""
import importlib
import sys
import types
from contextlib import contextmanager
from unittest.mock import MagicMock

import pytest

_STUBBED = ("cv2", "scenedetect", "scenedetect.detectors", "ultralytics",
            "torch", "tqdm", "yt_dlp", "mediapipe")


@contextmanager
def _import_main_with_stubs():
    saved = {m: sys.modules.get(m) for m in _STUBBED}
    try:
        for m in _STUBBED:
            sys.modules.setdefault(m, MagicMock())
        sys.modules["mediapipe"].solutions = MagicMock()
        saved["main"] = sys.modules.get("main")
        sys.modules.pop("main", None)
        yield importlib.import_module("main")
    finally:
        for m, orig in saved.items():
            if orig is None:
                sys.modules.pop(m, None)
            else:
                sys.modules[m] = orig


def _client(raises):
    """raises(n) -> the exception attempt n (1-based) should see, or None."""
    state = {"n": 0}

    def generate_content(model=None, contents=None, config=None):
        state["n"] += 1
        err = raises(state["n"])
        if err is not None:
            raise err
        return types.SimpleNamespace(parsed=None)

    return types.SimpleNamespace(
        models=types.SimpleNamespace(generate_content=generate_content)), state


def _quiet_helpers(main, monkeypatch):
    monkeypatch.setattr(main.gemini_worker, "_parse_json_response_text",
                        lambda text: {"clips": []})
    monkeypatch.setattr(main.gemini_worker, "_get_response_text", lambda r: "")
    monkeypatch.setattr(main.gemini_worker, "_calculate_cost_analysis",
                        lambda r, m: None)


def test_a_four_attempt_spike_no_longer_kills_the_job(monkeypatch):
    with _import_main_with_stubs() as main:
        _quiet_helpers(main, monkeypatch)
    slept = []
    monkeypatch.setattr(main.time, "sleep", lambda s: slept.append(s))
    client, state = _client(
        lambda n: RuntimeError("503 UNAVAILABLE high demand") if n <= 4 else None)

    parsed, cost = main._run_gemini_stage(client, "gemini-test", "prompt", dict)
    assert parsed == {"clips": []}
    assert state["n"] == 5
    assert len(slept) == 4
    assert all(0 <= s <= 90 for s in slept)


def test_budget_is_configurable(monkeypatch):
    with _import_main_with_stubs() as main:
        pass
    monkeypatch.setenv("GEMINI_STAGE_RETRIES", "2")
    slept = []
    monkeypatch.setattr(main.time, "sleep", lambda s: slept.append(s))
    client, state = _client(lambda n: RuntimeError("503 UNAVAILABLE high demand"))
    with pytest.raises(RuntimeError):
        main._run_gemini_stage(client, "gemini-test", "prompt", dict)
    assert state["n"] == 2
    assert len(slept) == 1


def test_policy_blocks_never_retry(monkeypatch):
    with _import_main_with_stubs() as main:
        monkeypatch.setattr(main.gemini_worker, "raise_if_blocked",
                            MagicMock(side_effect=main.gemini_worker.GeminiBlockedError("blocked")))
    monkeypatch.setattr(main.time, "sleep", lambda s: None)
    client, state = _client(lambda n: None)
    with pytest.raises(main.gemini_worker.GeminiBlockedError):
        main._run_gemini_stage(client, "gemini-test", "prompt", dict)
    assert state["n"] == 1
