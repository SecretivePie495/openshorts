"""Shared constants and callback registry for editor_v2 / app.py.

Keeps editor_v2 free of circular imports: it never imports app.py, but
receives the app-specific callbacks and settings it needs through callers.
"""
import os

# Mirror of app.py constants — stays in sync because app.py imports this module.
OUTPUT_DIR = os.environ.get("OPENSHORTS_OUTPUT", "output")

# Mirrors _FRAMING_STRATEGIES in app.py.
FRAMING_STRATEGIES = {"auto": None, "full": "WIDE", "track": "TRACK"}


# Callback registry — populated by app.py at startup so editor_v2 can call
# into app-owned logic (quota, asset lookup, health-check) without a direct
# import. Each entry is set exactly once during app init.
class _AppCallbacks:
    ensure_job_files=None    # async(job_id, request) -> bool
    owner_id=None            # async(request) -> int
    reserve_managed_action=None  # async(request, minutes, job_id, type) -> str|None
    commit_reservation=None  # async(id)
    release_reservation=None # async(id)
    metering=None            # module-level (for QuotaExceeded check)


callbacks = _AppCallbacks()
