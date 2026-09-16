"""What a dead job process reports (app._exit_reason).

"Process failed with exit code -9" is not something main.py can do to itself —
a negative code is a signal, and -9 is SIGKILL, which means something else
killed it. In practice that is the OOM killer, and the reason it keeps finding
this process is structural: every job is its own main.py loading its own
transcription model, so MAX_CONCURRENT_JOBS of them stack that many copies and
the in-process ASR gate cannot see across processes.

The old message sent people looking for a bug in the pipeline. These pin the
message that points at the actual knob instead.
"""
import pytest

app = pytest.importorskip("app")
alerts = pytest.importorskip("cloud.alerts")


class TestOrdinaryFailures:
    @pytest.mark.parametrize("code", [1, 2, 127])
    def test_a_real_exit_code_reads_as_before(self, code):
        assert app._exit_reason(code) == f"Process failed with exit code {code}"

    def test_zero_is_not_dressed_up_as_a_signal(self):
        assert "killed" not in app._exit_reason(0).lower()


class TestKilledProcesses:
    def test_sigkill_names_memory_and_the_knob(self):
        message = app._exit_reason(-9)
        assert "SIGKILL" in message
        assert "out-of-memory" in message
        # The actionable part: without it this is just a different mystery.
        assert "MAX_CONCURRENT_JOBS" in message

    def test_the_current_concurrency_is_quoted(self, monkeypatch):
        monkeypatch.setattr(app, "MAX_CONCURRENT_JOBS", 3)
        assert "MAX_CONCURRENT_JOBS=3" in app._exit_reason(-9)

    def test_other_signals_are_named_not_numbered(self):
        assert "SIGTERM" in app._exit_reason(-15)

    def test_an_unknown_signal_still_says_it_was_killed(self):
        message = app._exit_reason(-99)
        assert "killed" in message.lower()
        assert "99" in message


class TestAlerting:
    def test_a_kill_is_its_own_category(self):
        # It recurs on every job until someone changes memory or concurrency,
        # so "mixed" was actively unhelpful.
        assert alerts._classify_failure(app._exit_reason(-9)) == "out of memory"

    def test_the_bare_exit_code_form_is_caught_too(self):
        # Older logs and anything that formats the code itself.
        assert alerts._classify_failure(
            "Process failed with exit code -9") == "out of memory"

    def test_it_does_not_swallow_unrelated_failures(self):
        assert alerts._classify_failure("faster_whisper blew up") == "transcription"
