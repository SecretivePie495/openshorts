"""Emoji in progress output must not be able to kill a job.

Every entry point in this repo prints emoji, and Python takes stdout's encoding
from the locale — not from the fact that the string is UTF-8. On a Windows
console that locale is cp1252; under a bare C locale it is ASCII; and when
stdout is a pipe (which is exactly how app.py runs main.py) there is no
terminal to ask. The first 🤖 then raises UnicodeEncodeError and takes the
process with it, which is how the API once died during startup before it
listened (see the comment at the top of app.py).

Three modules grew their own reconfigure() block after being bitten one at a
time — app.py, subtitles.py, gemini_worker.py — while main.py and
saasshorts.py, which print the most, never did. PYTHONIOENCODING fixes it for
every entry point at once, including ones nobody has written yet.
"""
import pathlib
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent

# The same characters main.py prints on its normal path.
EMOJI_SCRIPT = "print('\\U0001f916 Analyzing \\u2705 done \\U0001f525')"


def _run(env_encoding):
    """Run a child that prints emoji with stdout on a PIPE, as run_job does."""
    import os
    env = dict(os.environ)
    env.pop("PYTHONUTF8", None)  # PEP 540 would otherwise mask the locale
    if env_encoding is None:
        env.pop("PYTHONIOENCODING", None)
    else:
        env["PYTHONIOENCODING"] = env_encoding
    return subprocess.run([sys.executable, "-c", EMOJI_SCRIPT],
                          capture_output=True, env=env, timeout=60)


class TestTheFailureMode:
    def test_a_non_utf8_stdout_kills_the_child(self):
        """The bug itself: this is what a Windows console or C locale does."""
        result = _run("ascii")
        assert result.returncode != 0
        assert b"UnicodeEncodeError" in result.stderr

    def test_utf8_saves_it(self):
        result = _run("utf-8")
        assert result.returncode == 0
        assert "\U0001f916" in result.stdout.decode("utf-8")


class TestTheFixIsWiredIn:
    def test_the_image_sets_it(self):
        dockerfile = (ROOT / "Dockerfile").read_text()
        assert "PYTHONIOENCODING=utf-8" in dockerfile, (
            "The image must set PYTHONIOENCODING, or every entry point that "
            "prints emoji depends on the base image's locale.")

    def test_the_job_subprocess_gets_it(self, monkeypatch):
        """app.py runs main.py with stdout on a pipe, so the locale decides —
        and the API may be running outside the image."""
        app = pytest.importorskip("app")
        captured = {}

        class DoneProcess:
            # Non-zero on purpose: the success branch goes on to archive the
            # job's artifacts, and this test is only about the env that was
            # handed to Popen.
            returncode = 1
            stdout = None

            def poll(self):
                return 1

        def fake_popen(cmd, **kwargs):
            captured.update(kwargs)
            return DoneProcess()

        monkeypatch.setattr(app.subprocess, "Popen", fake_popen)
        monkeypatch.setattr(app.threading, "Thread",
                            lambda *a, **k: type("T", (), {
                                "daemon": True, "start": lambda self: None})())
        app.jobs["enc-test"] = {"status": "queued", "logs": [], "ready_files": {}}
        try:
            import asyncio
            asyncio.run(app.run_job("enc-test", {
                "cmd": [sys.executable, "-c", "pass"],
                "env": {"EXISTING": "kept"},
                "output_dir": str(ROOT),
            }))
        finally:
            app.jobs.pop("enc-test", None)

        env = captured.get("env") or {}
        assert env.get("PYTHONIOENCODING") == "utf-8"
        assert env.get("EXISTING") == "kept", "the job's own env must survive"
