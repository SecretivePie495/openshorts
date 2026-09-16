"""Run one transcript through both moment pickers and diff what they choose.

The scoring and detail passes decide which thirty seconds of a video are worth
posting and what the hook says, so they are most of what the product is. They
can run on Gemini or on any OpenAI-compatible server (llm_backend.py), and the
second option is free — but "free" is only a saving if the picks hold up, and
nothing in the test suite can tell you that. This runs the same transcript
through both and shows you the difference.

    python compare_backends.py output/<job_id>
    python compare_backends.py output/<job_id>/My_Video_metadata.json
    python compare_backends.py <job_id>            # looked up under OUTPUT_DIR

Needs GEMINI_API_KEY for one side and LLM_BASE_URL (plus LLM_MODEL /
LLM_API_KEY) for the other; it sets the switch itself per run, so whichever of
them is already in your environment does not decide the outcome.

It reuses a finished job's transcript rather than transcribing again: that is
the slow, expensive part, and it is identical for both backends anyway. Any job
in output/ with a *_metadata.json works.
"""
from __future__ import annotations

import argparse
import contextlib
import json
import os
import pathlib
import sys
import time

MATCH_IOU = 0.5
# Width of one rendered pick, so the two columns line up under their headers.
COL = 67


def _find_metadata(target: str) -> pathlib.Path:
    """Accept a metadata file, a job directory, or a bare job id."""
    path = pathlib.Path(target)
    if path.is_file():
        return path
    candidates = [path]
    if not path.is_absolute():
        candidates.append(pathlib.Path(os.environ.get("OUTPUT_DIR", "output")) / target)
    for directory in candidates:
        if directory.is_dir():
            found = sorted(directory.glob("*_metadata.json"))
            if found:
                return found[0]
    raise SystemExit(
        f"No *_metadata.json found for {target!r}. Point this at a finished "
        "job directory, its metadata file, or a job id under output/.")


def _duration(transcript: dict, clips: list) -> float:
    """Longest end timestamp anyone mentions — the windowing only needs a
    ceiling, and a metadata file does not record the source duration."""
    ends = [float(seg.get("end") or 0) for seg in transcript.get("segments", [])]
    ends += [float(c.get("end") or 0) for c in clips]
    return max(ends, default=0.0)


@contextlib.contextmanager
def _backend(kind: str):
    """Force one backend for the duration of the block.

    Both variables matter: llm_backend.provider() lets LLM_PROVIDER override
    the presence of a base URL, so leaving either at whatever the shell had
    would silently run the same side twice.
    """
    saved = {k: os.environ.get(k) for k in ("LLM_BASE_URL", "LLM_PROVIDER")}
    try:
        if kind == "gemini":
            os.environ.pop("LLM_BASE_URL", None)
            os.environ["LLM_PROVIDER"] = "gemini"
        else:
            if not saved["LLM_BASE_URL"]:
                raise SystemExit(
                    "LLM_BASE_URL is not set, so there is no second backend to "
                    "compare against. Point it at an OpenAI-compatible server "
                    "(OpenRouter, Ollama, vLLM, LM Studio).")
            os.environ["LLM_PROVIDER"] = "openai"
        yield
    finally:
        for key, value in saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def _run(kind: str, transcript: dict, duration: float) -> dict:
    import main

    print(f"\n{'=' * 72}\n  {kind.upper()}\n{'=' * 72}")
    started = time.monotonic()
    try:
        with _backend(kind):
            result = main.get_viral_clips(transcript, duration)
    except SystemExit:
        raise
    except Exception as e:
        print(f"   ✗ {kind} failed: {e}")
        return {"kind": kind, "clips": [], "seconds": time.monotonic() - started,
                "error": str(e)}
    elapsed = time.monotonic() - started
    if not result:
        return {"kind": kind, "clips": [], "seconds": elapsed,
                "error": "returned no clips"}
    return {
        "kind": kind,
        "clips": result.get("shorts") or [],
        "cost": result.get("cost_analysis") or {},
        "seconds": elapsed,
        "error": None,
    }


def _iou(a: dict, b: dict) -> float:
    """Temporal overlap of two picks, 0-1. Two backends agreeing on a moment
    will rarely agree on its exact boundaries, so this asks whether they found
    the same moment rather than whether they cut it identically."""
    a0, a1 = float(a.get("start", 0)), float(a.get("end", 0))
    b0, b1 = float(b.get("start", 0)), float(b.get("end", 0))
    overlap = max(0.0, min(a1, b1) - max(a0, b0))
    union = max(a1, b1) - min(a0, b0)
    return overlap / union if union > 0 else 0.0


def _match(left: list, right: list) -> list:
    """Greedy best-overlap pairing; each right-hand pick is used at most once."""
    taken, pairs = set(), []
    for clip in left:
        best, best_iou = None, 0.0
        for i, other in enumerate(right):
            if i in taken:
                continue
            score = _iou(clip, other)
            if score > best_iou:
                best, best_iou = i, score
        if best is not None and best_iou >= MATCH_IOU:
            taken.add(best)
            pairs.append((clip, right[best], best_iou))
        else:
            pairs.append((clip, None, best_iou))
    for i, other in enumerate(right):
        if i not in taken:
            pairs.append((None, other, 0.0))
    return pairs


def _clip_line(clip: dict | None) -> str:
    if clip is None:
        return f"{'(no counterpart)':<{COL}}"
    span = f"{float(clip.get('start', 0)):7.1f}-{float(clip.get('end', 0)):<7.1f}"
    score = str(clip.get("predicted_score") or "-")
    hook = (clip.get("viral_hook_text") or "").replace("\n", " ")
    return f"{span} {score:>3}  {hook[:COL - 21]:<{COL - 21}}"


def _report(a: dict, b: dict) -> int:
    print(f"\n{'=' * 72}\n  RESULT\n{'=' * 72}")
    for side in (a, b):
        cost = side.get("cost") or {}
        total = cost.get("total_cost")
        money = f"${total:.6f}" if isinstance(total, (int, float)) else "n/a"
        note = f"  ✗ {side['error']}" if side.get("error") else ""
        print(f"  {side['kind']:<18} {len(side['clips']):>2} clips  "
              f"{side['seconds']:6.1f}s  {money:>12}  "
              f"{cost.get('model', '-')}{note}")

    if not a["clips"] or not b["clips"]:
        print("\n  Nothing to compare — one side produced no clips.")
        return 1

    pairs = _match(a["clips"], b["clips"])
    matched = sum(1 for x, y, _ in pairs if x and y)

    print(f"\n  {'gemini':<{COL}}{'':>5}  {'openai-compatible'}")
    print(f"  {'-' * COL}{'':>5}  {'-' * COL}")
    for left, right, iou in pairs:
        marker = f"~{iou:.2f}" if left and right else "✗"
        print(f"  {_clip_line(left)}{marker:>5}  {_clip_line(right).rstrip()}")

    total = len(a["clips"])
    print(f"\n  {matched}/{total} of Gemini's picks found a counterpart "
          f"(overlap ≥ {MATCH_IOU:.0%}).")
    if matched == total and len(b["clips"]) == total:
        print("  The two backends chose the same moments. Read the hooks above "
              "for the wording, then judge on cost.")
    elif matched >= total * 0.6:
        print("  Mostly the same moments. Check whether the misses are ones "
              "you would have wanted.")
    else:
        print("  They disagree about what is worth clipping. The free backend "
              "is not a drop-in here — watch the actual clips before switching.")
    print("\n  Overlap says nothing about whether the HOOKS are any good. That "
          "part only a person can call: read both columns.")
    return 0


def main_cli() -> int:
    parser = argparse.ArgumentParser(
        description="Diff Gemini against an OpenAI-compatible backend on one transcript.")
    parser.add_argument("target", help="job id, job directory, or *_metadata.json")
    args = parser.parse_args()

    metadata_path = _find_metadata(args.target)
    metadata = json.loads(metadata_path.read_text())
    transcript = metadata.get("transcript") or {}
    if not transcript.get("segments"):
        raise SystemExit(
            f"{metadata_path} has no transcript segments — a silent-video job "
            "cannot exercise the text pickers.")

    duration = _duration(transcript, metadata.get("shorts") or [])
    words = sum(len((s.get("text") or "").split()) for s in transcript["segments"])
    print(f"Transcript: {metadata_path}\n"
          f"  {len(transcript['segments'])} segments, ~{words} words, "
          f"{duration:.0f}s, language={transcript.get('language', '?')}")

    if not os.getenv("GEMINI_API_KEY"):
        raise SystemExit("GEMINI_API_KEY is not set — nothing to compare against.")

    return _report(_run("gemini", transcript, duration),
                   _run("openai-compatible", transcript, duration))


if __name__ == "__main__":
    sys.exit(main_cli())
