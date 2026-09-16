"""Sizing the clip pool by memory as well as cores (ffmpeg_utils).

The pool was sized from cores alone. A container with plenty of cores and
little RAM therefore picked 3, started three 1080x1920 x264 encodes at once,
and got SIGKILLed partway through — which reaches the user as "Process failed
with exit code -9", nowhere near the decision that caused it. Cores say how
fast the pool can go; memory says whether it gets to finish.

memory_allowance_mb reads the CONTAINER's ceiling for the same reason
_cpu_allowance does: os.cpu_count() and /proc/meminfo both happily describe
the whole host from inside a cgroup.
"""
import pytest

fu = pytest.importorskip("ffmpeg_utils")

MB = 1024 * 1024


@pytest.fixture()
def fake_fs(monkeypatch):
    """Serve only the cgroup/meminfo paths a test names; everything else is
    absent, which is what a host missing that cgroup version looks like."""
    def _install(files):
        real_open = open

        def fake_open(path, *args, **kwargs):
            key = str(path)
            if key in files:
                import io
                return io.StringIO(files[key])
            if key.startswith("/sys/fs/cgroup") or key == "/proc/meminfo":
                raise FileNotFoundError(key)
            return real_open(path, *args, **kwargs)

        monkeypatch.setattr("builtins.open", fake_open)
    return _install


class TestReadingTheCeiling:
    def test_cgroup_v2_limit(self, fake_fs):
        fake_fs({"/sys/fs/cgroup/memory.max": str(2048 * MB)})
        assert fu.memory_allowance_mb() == 2048

    def test_cgroup_v2_unlimited_falls_through(self, fake_fs):
        # "max" is a word, not a number — reading it as one would be a crash.
        fake_fs({"/sys/fs/cgroup/memory.max": "max",
                 "/proc/meminfo": "MemAvailable:    4194304 kB\n"})
        assert fu.memory_allowance_mb() == 4096

    def test_cgroup_v1_limit(self, fake_fs):
        fake_fs({"/sys/fs/cgroup/memory/memory.limit_in_bytes": str(1024 * MB)})
        assert fu.memory_allowance_mb() == 1024

    def test_cgroup_v1_unlimited_is_recognised(self, fake_fs):
        # v1 reports unlimited as a number near 2**63, which would otherwise
        # read as several million terabytes and cap nothing.
        fake_fs({"/sys/fs/cgroup/memory/memory.limit_in_bytes": str(2 ** 63 - 1),
                 "/proc/meminfo": "MemAvailable:    8388608 kB\n"})
        assert fu.memory_allowance_mb() == 8192

    def test_bare_host_uses_what_is_actually_free(self, fake_fs):
        fake_fs({"/proc/meminfo": "MemTotal: 16000000 kB\n"
                                  "MemAvailable:  2097152 kB\n"})
        assert fu.memory_allowance_mb() == 2048

    def test_unknown_reports_zero_rather_than_guessing(self, fake_fs):
        fake_fs({})
        assert fu.memory_allowance_mb() == 0

    def test_garbage_does_not_raise(self, fake_fs):
        # This runs on the render path; a surprising cgroup file must not be
        # the thing that fails a job.
        fake_fs({"/sys/fs/cgroup/memory.max": "not-a-number"})
        assert fu.memory_allowance_mb() == 0


class TestTheCap:
    """The arithmetic main.py applies, pinned here so the intent is explicit."""

    def cap(self, mem_mb, by_cores, per_worker=None):
        per = per_worker or fu.CLIP_WORKER_MEMORY_MB
        if not mem_mb:
            return by_cores
        return min(by_cores, max(1, mem_mb // per))

    def test_a_roomy_container_keeps_its_cores_verdict(self):
        assert self.cap(8192, 3, per_worker=1500) == 3

    def test_a_tight_container_is_cut_down(self):
        # 2 GB cannot feed three 1080x1920 encodes, whatever the core count.
        assert self.cap(2048, 3, per_worker=1500) == 1

    def test_it_never_reaches_zero_workers(self):
        assert self.cap(100, 3, per_worker=1500) == 1

    def test_an_unreadable_ceiling_changes_nothing(self):
        assert self.cap(0, 3, per_worker=1500) == 3

    def test_the_cap_only_lowers(self):
        # Memory must not talk a 1-core box into running more encodes.
        assert self.cap(64000, 1, per_worker=1500) == 1
