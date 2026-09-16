"""Gemini calls must outlast a capacity spike, not a network blip — everywhere.

Prod 15-sep-2026: a scoring call died after 3 attempts spread over 15s while
Google's "high demand" 503 lasted minutes, and the quota dashboard showed the
jam is PER MODEL (RPM/TPM/RPD pools per model; 3.1-flash-lite at 38/500/day
while 3.5-flash-lite sat untouched at 0/500). gemini_worker's
generate_with_capacity_chain is the one survival kit every stage now calls:
six jittered attempts (GEMINI_STAGE_RETRIES) capped at 90s per model, then a
family jump (GEMINI_MODEL_FALLBACKS; the -latest alias shares the jammed
pools so it is NOT the default), and hard failures still raise immediately.

main.py imports the ML stack at module level; the helper itself does not, so
most of this file tests gemini_worker directly and only the _run_gemini_stage
wiring imports main under stubs.
"""
import importlib
import sys
import time
import types
from contextlib import contextmanager
from unittest.mock import MagicMock

import pytest

import gemini_worker


@pytest.fixture(autouse=True)
def _clear_cooldowns():
    gemini_worker._model_block_until.clear()
    yield
    gemini_worker._model_block_until.clear()


def _client(raises, log=None):
    """raises(n, model) -> exception attempt n (1-based) should see, or None.
    Records every (model, attempt) pair it was asked about."""
    state = {"n": 0, "models": [], "slept": []}

    def generate_content(model=None, contents=None, config=None):
        state["n"] += 1
        state["models"].append(model)
        err = raises(state["n"], model)
        if err is not None:
            raise err
        return types.SimpleNamespace(parsed={"clips": []}, text="{}")

    class _Models:
        def __init__(self, fn):
            self.generate_content = fn

    client = types.SimpleNamespace(models=_Models(generate_content))

    def _sleep(s):
        state["slept"].append(s)

    return client, state, _sleep


def _boom(n, models_dead):
    def raises(attempt, model):
        if model in models_dead:
            return RuntimeError("503 UNAVAILABLE high demand")
        return None
    return raises


class TestChain:
    def test_a_four_attempt_spike_no_longer_kills_the_call(self):
        client, state, sleep = _client(
            lambda n, m: RuntimeError("503 UNAVAILABLE") if n <= 4 else None)
        out, winner = gemini_worker.generate_with_capacity_chain(
            client, "gemini-x", contents="p", budget=6, sleep=sleep)
        assert state["n"] == 5
        assert winner == "gemini-x"
        assert len(state["slept"]) == 4
        assert all(0 <= s <= 90 for s in state["slept"])

    def test_budget_is_configurable(self, monkeypatch):
        monkeypatch.setenv("GEMINI_STAGE_RETRIES", "2")
        monkeypatch.setenv("GEMINI_MODEL_FALLBACKS", "")
        client, state, sleep = _client(
            lambda n, m: RuntimeError("503 UNAVAILABLE high demand"))
        with pytest.raises(RuntimeError):
            gemini_worker.generate_with_capacity_chain(
                client, "gemini-x", contents="p", sleep=sleep)
        assert state["n"] == 2

    def test_a_spike_past_the_budget_jumps_the_family(self, monkeypatch):
        monkeypatch.setenv("GEMINI_STAGE_RETRIES", "2")
        monkeypatch.setenv("GEMINI_MODEL_FALLBACKS", "gemini-sibling")
        client, state, sleep = _client(_boom(0, {"gemini-x"}))
        out, winner = gemini_worker.generate_with_capacity_chain(
            client, "gemini-x", contents="p", sleep=sleep)
        assert winner == "gemini-sibling"
        assert state["models"] == ["gemini-x", "gemini-x", "gemini-sibling"]

    def test_a_burnt_model_is_cooled_not_retried(self, monkeypatch):
        """Call 2 of the same job must go STRAIGHT to the sibling: 15+ calls
        each eating the full budget is exactly the 'never finishes' failure."""
        monkeypatch.setenv("GEMINI_STAGE_RETRIES", "2")
        monkeypatch.setenv("GEMINI_MODEL_FALLBACKS", "gemini-sibling")
        dead = {"gemini-x"}
        client, state, sleep = _client(_boom(0, dead))
        fake = {"t": 0.0}
        out, winner = gemini_worker.generate_with_capacity_chain(
            client, "gemini-x", contents="p", sleep=sleep,
            now=lambda: fake["t"])
        assert winner == "gemini-sibling"
        assert state["models"] == ["gemini-x", "gemini-x", "gemini-sibling"]
        # Second call: no budget burned on the cooled primary.
        fake["t"] += 1.0
        state["models"].clear()
        out, winner = gemini_worker.generate_with_capacity_chain(
            client, "gemini-x", contents="p", sleep=sleep,
            now=lambda: fake["t"])
        assert winner == "gemini-sibling"
        assert state["models"] == ["gemini-sibling"]

    def test_all_cooling_waits_the_shortest_then_answers(self, monkeypatch):
        monkeypatch.setenv("GEMINI_STAGE_RETRIES", "1")
        monkeypatch.setenv("GEMINI_MODEL_FALLBACKS", "gemini-sibling")
        client, state, sleep = _client(lambda n, m: None)
        fake = {"t": 0.0}
        gemini_worker._model_block_until["gemini-x"] = 30.0
        gemini_worker._model_block_until["gemini-sibling"] = 10.0

        def clk_sleep(s):
            state["slept"].append(s)
            fake["t"] += s  # the clock advances as waiting happens

        out, winner = gemini_worker.generate_with_capacity_chain(
            client, "gemini-x", contents="p", sleep=clk_sleep,
            now=lambda: fake["t"])
        # Sleeps ONLY the shortest remaining wait (sibling, 10s) and tries it
        # first — no point waiting 30s for x when the sibling is back at 10.
        assert winner == "gemini-sibling"
        assert state["slept"] == [10.0]
        assert state["models"] == ["gemini-sibling"]

    def test_daily_exhaustion_cools_for_an_hour_not_ten_minutes(self, monkeypatch):
        """429 RESOURCE_EXHAUSTED means the daily (RPD) pool is spent until
        midnight Pacific; re-trying it after 10 min burns the whole chain's
        day away, minutes at a time."""
        monkeypatch.delenv("GEMINI_MODEL_FALLBACKS", raising=False)
        monkeypatch.setenv("GEMINI_STAGE_RETRIES", "1")
        client, state, sleep = _client(
            lambda n, m: RuntimeError("429 RESOURCE_EXHAUSTED Quota exceeded"))
        fake = {"t": 0.0}
        with pytest.raises(RuntimeError):
            gemini_worker.generate_with_capacity_chain(
                client, "gemini-3-pro-exclusive", contents="p", sleep=sleep,
                now=lambda: fake["t"])
        assert fake["t"] == 0.0
        until = gemini_worker._model_block_until["gemini-3-pro-exclusive"]
        assert until == gemini_worker._EXHAUSTED_COOLDOWN_S == 3600

    def test_cooldown_expires(self, monkeypatch):
        monkeypatch.setenv("GEMINI_STAGE_RETRIES", "1")
        monkeypatch.setenv("GEMINI_MODEL_FALLBACKS", "")
        client, state, sleep = _client(
            lambda n, m: RuntimeError("503 UNAVAILABLE"))
        fake = {"t": 0.0}
        with pytest.raises(RuntimeError):
            gemini_worker.generate_with_capacity_chain(
                client, "gemini-x", contents="p", sleep=sleep,
                now=lambda: fake["t"])
        fake["t"] = gemini_worker._MODEL_COOLDOWN_S + 1
        state["models"].clear()
        with pytest.raises(RuntimeError):
            gemini_worker.generate_with_capacity_chain(
                client, "gemini-x", contents="p", sleep=sleep,
                now=lambda: fake["t"])
        assert state["models"]  # retried again after the cooldown


    def test_default_chain_for_the_pipeline_model(self, monkeypatch):
        """Free AI Studio caps are PER MODEL, and the dashboard (15-sep)
        showed four text models at 0 usage while 3.1-flash-lite was pinned:
        the default chain is the whole unused lineup, cheapest tier first."""
        monkeypatch.delenv("GEMINI_MODEL_FALLBACKS", raising=False)
        monkeypatch.setenv("GEMINI_STAGE_RETRIES", "1")
        dead = {"gemini-3.1-flash-lite", "gemini-3.5-flash-lite",
                "gemini-2.5-flash-lite"}
        client, state, sleep = _client(_boom(0, dead))
        out, winner = gemini_worker.generate_with_capacity_chain(
            client, "gemini-3.1-flash-lite", contents="p", sleep=sleep)
        assert winner == "gemini-3-flash"
        assert gemini_worker._model_chain("gemini-3.1-flash-lite") == [
            "gemini-3.1-flash-lite", "gemini-3.5-flash-lite",
            "gemini-2.5-flash-lite", "gemini-3-flash", "gemini-3.5-flash",
            "gemini-2.5-flash",
        ]

    def test_a_small_primary_still_chains_to_the_big_pools(self, monkeypatch):
        """The Railway config bug (GEMINI_MODEL=gemini-2.5-flash, a 20/day
        model) must no longer mean 'no fallbacks': every pool member chains
        to the rest, lite tiers first."""
        monkeypatch.delenv("GEMINI_MODEL_FALLBACKS", raising=False)
        chain = gemini_worker._model_chain("gemini-2.5-flash")
        assert chain[0] == "gemini-2.5-flash"
        assert chain[1:] == ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite",
                             "gemini-2.5-flash-lite", "gemini-3-flash",
                             "gemini-3.5-flash"]

    def test_custom_primary_gets_no_surprise_default(self, monkeypatch):
        monkeypatch.delenv("GEMINI_MODEL_FALLBACKS", raising=False)
        client, state, sleep = _client(
            lambda n, m: RuntimeError("503 UNAVAILABLE high demand"))
        with pytest.raises(RuntimeError):
            gemini_worker.generate_with_capacity_chain(
                client, "gemini-3-pro", contents="p", budget=2, sleep=sleep)
        assert state["models"] == ["gemini-3-pro", "gemini-3-pro"]

    def test_hard_failures_never_switch_models(self, monkeypatch):
        monkeypatch.setenv("GEMINI_MODEL_FALLBACKS", "gemini-sibling")
        client, state, sleep = _client(
            lambda n, m: RuntimeError("400 INVALID_ARGUMENT bad schema"))
        with pytest.raises(RuntimeError):
            gemini_worker.generate_with_capacity_chain(
                client, "gemini-x", contents="p", sleep=sleep)
        assert state["models"] == ["gemini-x"]

    def test_policy_blocks_never_retry(self, monkeypatch):
        client, state, sleep = _client(lambda n, m: None)
        monkeypatch.setattr(gemini_worker, "raise_if_blocked",
                            MagicMock(side_effect=gemini_worker.GeminiBlockedError("x")))
        with pytest.raises(gemini_worker.GeminiBlockedError):
            gemini_worker.generate_with_capacity_chain(
                client, "gemini-x", contents="p",
                validate=gemini_worker.raise_if_blocked, sleep=sleep)
        assert state["n"] == 1

    def test_validate_runs_in_the_loop(self):
        # A 200 with an empty body (validate raising a transient-shaped
        # error) must consume a retry and succeed next attempt, not escape.
        calls = {"n": 0}

        def generate_content(model=None, contents=None, config=None):
            calls["n"] += 1
            return types.SimpleNamespace(empty=calls["n"] < 3)

        def validate(resp):
            if resp.empty:
                raise RuntimeError("did not contain a JSON object")
            return {"ok": True}

        out, winner = gemini_worker.generate_with_capacity_chain(
            types.SimpleNamespace(models=types.SimpleNamespace(
                generate_content=generate_content)),
            "gemini-x", contents="p", validate=validate,
            sleep=lambda s: None)
        assert out == {"ok": True} and calls["n"] == 3


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


def test_stage_wiring_keeps_cost_and_parse_contract(monkeypatch):
    with _import_main_with_stubs() as main:
        monkeypatch.setattr(main.gemini_worker, "_parse_json_response_text",
                            lambda t: {"clips": []})
        monkeypatch.setattr(main.gemini_worker, "_get_response_text",
                            lambda r: "")
        costs = {}

        def _cost(response, model):
            costs["args"] = (response, model)
            return {"cost": 1}

        monkeypatch.setattr(main.gemini_worker, "_calculate_cost_analysis", _cost)
        client, state, sleep = _client(lambda n, m: None)
        monkeypatch.setattr(main.gemini_worker.time, "sleep", sleep)
        monkeypatch.setattr(main.llm_backend, "active", lambda: False)
        parsed, cost = main._run_gemini_stage(
            client, "gemini-3.1-flash-lite", "prompt", dict)
        assert parsed == {"clips": []}
        assert cost == {"cost": 1}
        # The cost row names the model that ANSWERED, on the raw response.
        assert costs["args"][1] == "gemini-3.1-flash-lite"
        assert costs["args"][0] is not None


class TestStageWatchdog:
    """A wedged in-process stage must end the job with the stage NAMED."""

    def _main(self):
        with _import_main_with_stubs() as m:
            return m

    def test_a_hung_stage_raises_after_the_limit(self):
        m = self._main()
        started = []

        def hang():
            started.append(True)
            time.sleep(30)

        with pytest.raises(RuntimeError, match="Transcription exceeded its"):
            m._run_stage("Transcription", hang, timeout_min=1.0 / 60.0)
        assert started == [True]

    def test_a_fast_stage_returns_its_value(self):
        m = self._main()
        assert m._run_stage("Download", lambda: ("path", "title"), 1) == ("path", "title")

    def test_zero_disables_the_watchdog(self):
        m = self._main()
        assert m._run_stage("Transcription", lambda: 42, 0) == 42
