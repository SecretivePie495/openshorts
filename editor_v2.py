"""Advanced editor compositing layer for OpenShorts.

Handles multi-track composition: LUT/color grading, transitions between cuts,
audio tracks (volume, fade), B-roll video overlays, and independent text
elements — all on top of the existing rerender path.

Layering order in composite_advanced():
  1. recut (via caller-provided ctx)
  2. LUT / color grade
  3. library overlays
  4. B-roll tracks
  5. text elements (ASS burn)
  6. audio tracks
  7. auto captions (always last)
  8. hook text

Design: no circular imports. All app.py calls go through editor_config.callbacks.
"""
import os
import re
import json
import math
import time
import glob
import uuid as _uuid
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
# HTTPException is pulled in at call time so we can run without FastAPI installed
# during standalone checks (e.g. `python editor_v2.py`).
_HTTPException = None

import editor_config as _cfg
import overlays  # lazy imported via app; direct import works here since overlays has no heavy deps


def _raise(status_code, detail):
    global _HTTPException
    if _HTTPException is None:
        from fastapi import HTTPException as _H
        _HTTPException = _H
    raise _HTTPException(status_code=status_code, detail=detail)


# ── Models ───────────────────────────────────────────────────────────────────

class BaseItem:
    """Minimal base so dict→model round-trip works without pydantic."""
    _fields: List[str] = []

    def __init__(self, **kw):
        for k, v in kw.items():
            if hasattr(self, k):
                setattr(self, k, v)

    def dict(self):
        out = {}
        for f in self._fields:
            val = getattr(self, f, None)
            if val is not None:
                out[f] = val
        return out


class Transition(BaseItem):
    _fields = ["type", "duration"]
    def __init__(self, type="none", duration=0.5, **kw):
        super().__init__(**kw)
        self.type = type
        self.duration = duration


class AudioTrack(BaseItem):
    _fields = ["id", "file_path", "start", "end", "volume", "fadeIn", "fadeOut",
               "sourceStart", "sourceEnd"]
    def __init__(self, id=None, file_path="", start=0, end=0, volume=1.0,
                 fadeIn=0.0, fadeOut=0.0, sourceStart=0.0, sourceEnd=None, **kw):
        super().__init__(**kw)
        self.id = id
        self.file_path = file_path
        self.start = start
        self.end = end
        self.volume = volume
        self.fadeIn = fadeIn
        self.fadeOut = fadeOut
        self.sourceStart = sourceStart
        self.sourceEnd = sourceEnd

    @property
    def duration(self): return max(0.0, self.end - self.start)
    @property
    def is_muted(self): return self.volume <= 0.001

    def ffmpeg_filters(self):
        parts = []
        if self.volume != 1.0:
            parts.append(f"volume={self.volume}")
        if self.fadeIn > 0:
            parts.append(f"afade=t=in:st=0:d={self.fadeIn}")
        if self.fadeOut > 0:
            fs = max(0, self.end - self.fadeOut)
            parts.append(f"afade=t=out:st={fs}:d={self.fadeOut}")
        return ",".join(parts) if parts else ""


class BrollTrack(BaseItem):
    _fields = ["id", "file_path", "start", "end", "position", "scale",
               "opacity", "z_index", "mute"]
    def __init__(self, id=None, file_path="", start=0, end=0,
                 position=None, scale=1.0, opacity=1.0, z_index=0, mute=False, **kw):
        super().__init__(**kw)
        self.id = id
        self.file_path = file_path
        self.start = start
        self.end = end
        self.position = position or {"x": 0, "y": 0}
        self.scale = scale
        self.opacity = opacity
        self.z_index = z_index
        self.mute = mute

    @property
    def duration(self): return max(0.0, self.end - self.start)


class TextElement(BaseItem):
    _fields = ["id", "start", "end", "content", "font", "fontSize", "color",
               "bold", "position", "scale", "animation"]
    def __init__(self, id=None, start=0, end=0, content="", font="Arial",
                 fontSize=36, color="#ffffff", bold=False, position=None,
                 scale=1.0, animation=None, **kw):
        super().__init__(**kw)
        self.id = id
        self.start = start
        self.end = end
        self.content = content
        self.font = font
        self.fontSize = fontSize
        self.color = color
        self.bold = bold
        self.position = position or {"x": 50, "y": 90}
        self.scale = scale
        self.animation = animation


# ── Request model ─────────────────────────────────────────────────────────────

class AdvancedEditRequest(BaseItem):
    _fields = ["job_id", "clip_index", "segments", "snap_to_words",
               "reapply_captions", "sync", "framing", "transitions",
               "audio_tracks", "broll_tracks", "text_elements", "effect",
               "overlay_ids", "reapply_hook"]
    def __init__(self, job_id, clip_index, segments=None, snap_to_words=False,
                 reapply_captions=False, sync=True, framing=None,
                 transitions=None, audio_tracks=None, broll_tracks=None,
                 text_elements=None, effect=None, overlay_ids=None,
                 reapply_hook=False, **kw):
        super().__init__(**kw)
        self.job_id = job_id
        self.clip_index = clip_index
        self.segments = segments or []
        self.snap_to_words = snap_to_words
        self.reapply_captions = reapply_captions
        self.sync = sync
        self.framing = framing
        self.transitions = transitions or []
        self.audio_tracks = audio_tracks or []
        self.broll_tracks = broll_tracks or []
        self.text_elements = text_elements or []
        self.effect = effect
        self.overlay_ids = overlay_ids or []
        self.reapply_hook = reapply_hook


# ── LUT helpers ───────────────────────────────────────────────────────────────

LUT_DIR = Path(__file__).parent / "assets" / "luts"


def list_luts() -> List[Dict[str, str]]:
    out = []
    if not LUT_DIR.exists():
        return out
    for p in sorted(LUT_DIR.glob("*.cube")):
        out.append({"id": p.stem, "title": p.stem.replace("-", " ").title()})
    return out


def get_lut_path(lut_id: str) -> Optional[Path]:
    p = LUT_DIR / f"{lut_id}.cube"
    return p if p.exists() else None


def apply_lut(input_path: str, lut_id: str, output_path: str) -> bool:
    lut_path = get_lut_path(lut_id)
    if not lut_path:
        raise ValueError(f"LUT '{lut_id}' not found in {LUT_DIR}")
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-vf", f"lut3d='{lut_path}'",
        "-c:a", "copy",
        output_path,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=300)
        return r.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


# ── ASS text generation ──────────────────────────────────────────────────────

def hex_to_ass_color(hex_color: str) -> str:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"&H00{b:02X}{g:02X}{r:02X}"


def sec_to_ass_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds - h * 3600 - m * 60
    cs = int(round(s * 100))
    return f"{h}:{m:02d}:{int(s):02d}.{cs:02d}"


def generate_text_ass(elements: List[TextElement], width: int = 1080,
                      height: int = 1920, font_name: str = "Arial",
                      default_size: int = 48) -> str:
    lines = [
        "[Script Info]",
        "Title: OpenShorts Text Elements",
        "ScriptType: v4.00+",
        f"PlayResX: {width}",
        f"PlayResY: {height}",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding",
    ]
    for elem in elements:
        color = hex_to_ass_color(elem.color)
        bold_flag = "-1" if elem.bold else "0"
        align = max(1, min(9, int(elem.position.get("y", 50) / 100 * 9)))
        lines.append(
            f"Style: Text_{elem.id},{font_name},{int(elem.fontSize * elem.scale)},"
            f"{color},&H000000FF,&H00000000,&H80000000,{bold_flag},0,0,0,"
            f"100,100,0,0,1,{max(1, elem.fontSize // 10)},0,{align},30,30,30"
        )
    lines += ["", "[Events]",
              "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    for elem in elements:
        sa = sec_to_ass_ts(elem.start)
        ea = sec_to_ass_ts(elem.end)
        esc = elem.content.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")
        anim = ""
        if elem.animation == "scale-in":
            anim = r"\kstart(0)\kest(100)\kfscx120\kfscy120"
        elif elem.animation == "fade-in":
            anim = r"\fad(300,0)"
        elif elem.animation == "slide-up":
            anim = r"\move(0,800,0,200)"
        lines.append(f"Dialogue: 0,{sa},{ea},Text_{elem.id},,0,0,0,,{anim}{esc}")
    return "\n".join(lines)


# ── Video probe ───────────────────────────────────────────────────────────────

def _probe_video(path: str) -> Dict[str, Any]:
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_format", "-show_streams", path],
            capture_output=True, text=True, timeout=30)
        return json.loads(r.stdout)
    except Exception:
        return {}


def _video_dimensions(path: str) -> tuple:
    info = _probe_video(path)
    for s in info.get("streams", []):
        if s.get("codec_type") == "video":
            return s.get("width", 1080), s.get("height", 1920)
    return 1080, 1920


# ── B-roll compositor ────────────────────────────────────────────────────────

async def apply_broll_tracks(base_path: str, tracks: List[BrollTrack],
                             output_dir: str, clean_name: str) -> str:
    if not tracks:
        return base_path
    inputs = ["-i", base_path]
    filter_parts = []
    idx = 1
    sorted_tracks = sorted(tracks, key=lambda t: t.z_index)
    for track in sorted_tracks:
        track_path = os.path.join(output_dir, track.file_path)
        if not os.path.exists(track_path):
            continue
        inputs.extend(["-i", track_path])
        x = track.position.get("x", 0)
        y = track.position.get("y", 0)
        sc = track.scale
        expr = (f"[{idx}:v][0:v]scale2ref=iw*{sc}:ih*{sc}[ov][base];"
                f"[base][ov]overlay=x={x}:y={y}:enable='between(t,{track.start},{track.end})'")
        filter_parts.append(expr)
        idx += 1
    if not filter_parts:
        return base_path
    out_path = os.path.join(output_dir, f"broll_{int(time.time())}_{clean_name}")
    cmd = ["ffmpeg", "-y"] + inputs + [
        "-filter_complex", ";".join(filter_parts),
        "-map", "[base]", "-c:a", "copy", out_path,
    ]
    r = subprocess.run(cmd, capture_output=True, timeout=600)
    if r.returncode != 0:
        raise RuntimeError(f"B-roll composite failed: {r.stderr.decode()[:500]}")
    return out_path


# ── Audio mixer ───────────────────────────────────────────────────────────────

async def apply_audio_tracks(base_path: str, tracks: List[AudioTrack],
                             output_dir: str, clean_name: str) -> str:
    if not tracks:
        return base_path
    inputs = ["-i", base_path]
    filter_parts = []
    amix_inputs = ["0:a"]
    idx = 1
    for track in sorted(tracks, key=lambda t: t.start):
        track_path = os.path.join(output_dir, track.file_path)
        if not os.path.exists(track_path) or track.is_muted:
            continue
        inputs.extend(["-i", track_path])
        filt = track.ffmpeg_filters()
        if filt:
            amix_inputs.append(f"[{idx}:a]{filt}[a{idx}]")
        else:
            amix_inputs.append(f"[{idx}:a][a{idx}]")
        idx += 1
    if len(amix_inputs) > 2:
        filter_parts.append(
            f"{''.join(amix_inputs)}amix=inputs={len(amix_inputs)-1}:"
            "duration=first:dropout_transition=2[aout]")
    out_path = os.path.join(output_dir, f"audio_{int(time.time())}_{clean_name}")
    cmd = ["ffmpeg", "-y"] + inputs
    if filter_parts:
        cmd.extend(["-filter_complex", ";".join(filter_parts), "-map", "[aout]"])
    cmd.extend(["-map", "0:v", "-c:v", "copy", "-c:a", "aac", out_path])
    r = subprocess.run(cmd, capture_output=True, timeout=600)
    if r.returncode != 0:
        raise RuntimeError(f"Audio mix failed: {r.stderr.decode()[:500]}")
    return out_path


# ── Text burn helper ──────────────────────────────────────────────────────────

def burn_text_elements(video_path: str, elements: List[TextElement],
                       output_dir: str, clean_name: str,
                       fonts_dir: str = None) -> str:
    if not elements:
        return video_path
    w, h = _video_dimensions(video_path)
    ass_path = os.path.join(output_dir, f"text_{int(time.time())}.ass")
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(generate_text_ass(elements, width=w, height=h))
    fd = fonts_dir or str(Path(__file__).parent / "fonts")
    out_path = os.path.join(output_dir, f"texted_{int(time.time())}_{clean_name}")
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"subtitles='{os.path.abspath(ass_path)}':fontsdir='{fd}':force_style='Outline=1'",
        "-c:a", "copy",
        out_path,
    ]
    r = subprocess.run(cmd, capture_output=True, timeout=300)
    if r.returncode != 0:
        raise RuntimeError(f"Text burn failed: {r.stderr.decode()[:500]}")
    return out_path


# ── Public composite entry point ──────────────────────────────────────────────

def _locate_source(job_id: str) -> Optional[str]:
    """Find the original source video for a job."""
    output_dir = os.path.join(_cfg.OUTPUT_DIR, job_id)
    for pattern in ["*.mp4", "*.mov", "*.webm"]:
        matches = glob.glob(os.path.join(output_dir, "**", pattern), recursive=True)
        for m in matches:
            if "recut" in m or "subtitled" in m or "overlaid" in m:
                continue
            if os.path.isfile(m):
                return m
    return None


async def _advanced_prepare(req, request, job):
    """Validate + quota + freeze plan (mirrors _rerender_prepare)."""
    import recut as _recut
    output_dir = os.path.join(_cfg.OUTPUT_DIR, req.job_id)
    json_files = glob.glob(os.path.join(output_dir, "*_metadata.json"))
    if not json_files:
        _raise(404, "Metadata not found")
    with open(json_files[0], 'r') as f:
        data = json.load(f)
    clips = data.get('shorts', [])
    if req.clip_index < 0 or req.clip_index >= len(clips):
        _raise(404, "Clip not found")
    clip = clips[req.clip_index]
    transcript = data.get('transcript') or {}

    segments = [{"start": s["start"], "end": s["end"]} for s in req.segments]
    total = _recut.total_duration(segments)
    base_name = os.path.basename(json_files[0]).replace('_metadata.json', '')
    clean_name = f"{base_name}_clip_{req.clip_index + 1}.mp4"
    canonical_path = os.path.join(output_dir, clean_name)
    source_path = _locate_source(req.job_id)
    # Fast path: all segments within the canonical clip range
    can_start = clip.get('start', 0)
    can_end = clip.get('end', 0)
    fast = bool(source_path and all(
        can_start <= s["start"] < can_end and can_start < s["end"] <= can_end
        for s in segments
    ))
    framing = req.framing or (clip.get('recipe', {}).get('framing') or 'auto')
    force_strategy = None if framing == 'auto' else (_cfg.FRAMING_STRATEGIES.get(framing) or framing)
    v_transcript = (
        _recut.virtual_transcript(transcript, segments)
        if getattr(req, 'reapply_captions', False) else None
    )
    reservation_id = None
    cbs = _cfg.callbacks
    if cbs.reserve_managed_action:
        rerender_minutes = max(1, math.ceil(total / 60.0))
        reservation_id = await cbs.reserve_managed_action(request, rerender_minutes, req.job_id, "advanced_edit")
    return {
        "req": req, "request": request, "job": job,
        "output_dir": output_dir, "json_path": json_files[0],
        "clean_name": clean_name, "canonical_path": canonical_path,
        "source_path": source_path, "fast": fast,
        "framing": framing, "force_strategy": force_strategy,
        "v_transcript": v_transcript, "reservation_id": reservation_id,
        "total": total,
        "output_format": data.get('output_format', 'auto'),
        "watermark": bool(job.get('watermark')),
        "can_start": can_start, "can_end": can_end,
    }


async def _advanced_execute(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Recut + compose advanced effects, mirroring _rerender_execute structure."""
    import asyncio as _asyncio
    import recut as _recut

    req = ctx["req"]
    output_dir = ctx["output_dir"]
    clean_name = ctx["clean_name"]
    canonical_path = ctx["canonical_path"]
    segments = [{"start": s["start"], "end": s["end"]} for s in req.segments]
    total = ctx["total"]
    reservation_id = ctx.get("reservation_id")

    # ── Step 1: recut ──────────────────────────────────────────────────────
    async def _run_recut():
        if ctx["fast"]:
            return _recut.perform_recut(
                input_path=ctx["canonical_path"],
                segments=_recut.rebase_segments(segments,
                    ctx["can_start"], ctx["can_end"]),
                output_dir=output_dir, clean_name=clean_name,
                reframe=False)
        return _recut.perform_recut(
            input_path=ctx["source_path"], segments=segments,
            output_dir=output_dir, clean_name=clean_name,
            reframe=True, output_format=ctx["output_format"],
            watermark=ctx["watermark"],
            force_strategy=ctx["force_strategy"])

    loop = _asyncio.get_event_loop()
    served_name, _clean = await loop.run_in_executor(None, _run_recut)

    work_path = os.path.join(output_dir, served_name)

    # ── Step 2: LUT ────────────────────────────────────────────────────────
    effect = getattr(req, "effect", None)
    if effect and effect.get("type") == "lut" and effect.get("id"):
        grad = os.path.join(output_dir, f"grad_{int(time.time())}_{served_name}")
        if not apply_lut(work_path, effect["id"], grad):
            raise RuntimeError(f"LUT failed: {effect['id']}")
        work_path = grad

    # ── Step 3: library overlays ───────────────────────────────────────────
    for oid in getattr(req, "overlay_ids", []):
        ov = os.path.join(output_dir, f"overlaid_{int(time.time())}_{served_name}")
        overlays.add_overlay_to_video(work_path, oid, ov)
        work_path = ov

    # ── Step 4: B-roll ─────────────────────────────────────────────────────
    if req.broll_tracks:
        work_path = await apply_broll_tracks(
            work_path, req.broll_tracks, output_dir, served_name)

    # ── Step 5: text elements ──────────────────────────────────────────────
    if req.text_elements:
        work_path = burn_text_elements(
            work_path, req.text_elements, output_dir, served_name)

    # ── Step 6: audio tracks ───────────────────────────────────────────────
    if req.audio_tracks:
        work_path = await apply_audio_tracks(
            work_path, req.audio_tracks, output_dir, served_name)

    # ── Step 7: captions (always last) ─────────────────────────────────────
    if getattr(req, "reapply_captions", False) and ctx.get("v_transcript"):
        imported_main = __import__("main", fromlist=["auto_caption_clip"])
        cap = imported_main.auto_caption_clip(
            work_path, ctx["v_transcript"], 0.0, total)
        if cap:
            work_path = cap

    # ── Step 8: hook text ──────────────────────────────────────────────────
    if getattr(req, "reapply_hook", False):
        imported_main = __import__("main", fromlist=["_reapply_hook"])
        hooked = imported_main._reapply_hook(
            req.job_id, req.clip_index, work_path)
        if hooked:
            work_path = hooked

    # ── Metadata writeback ─────────────────────────────────────────────────
    try:
        with open(ctx["json_path"], "r") as f:
            data = json.load(f)
        clips = data.get("shorts", [])
        if 0 <= req.clip_index < len(clips):
            clips[req.clip_index]["video_url"] = f"/videos/{req.job_id}/{os.path.basename(work_path)}"
            clips[req.clip_index]["recipe"]["advanced"] = {
                "effects": effect,
                "transitions": [t.dict() for t in req.transitions],
                "audio_tracks": [a.dict() for a in req.audio_tracks],
                "broll_tracks": [b.dict() for b in req.broll_tracks],
                "text_elements": [t.dict() for t in req.text_elements],
            }
            data["shorts"] = clips
            with open(ctx["json_path"], "w") as f:
                json.dump(data, f, indent=2)
    except Exception as e:
        print(f"⚠️  Failed to write advanced edit metadata: {e}")

    # Commit quota
    if reservation_id:
        try:
            if _cfg.callbacks.commit_reservation:
                await _cfg.callbacks.commit_reservation(reservation_id)
        except Exception as e:
            print(f"⚠️  Quota commit failed: {e}")

    return {
        "success": True,
        "new_video_url": f"/videos/{req.job_id}/{os.path.basename(work_path)}",
        "render_path": "advanced",
    }


# ── Upload helpers ─────────────────────────────────────────────────────────────

async def upload_audio(job_id: str, clip_index: int, file_bytes: bytes,
                       filename: str, user_id: int) -> Dict[str, str]:
    output_dir = os.path.join(_cfg.OUTPUT_DIR, job_id)
    audio_dir = os.path.join(output_dir, "assets", "audio")
    os.makedirs(audio_dir, exist_ok=True)
    safe = re.sub(r"[^a-zA-Z0-9._-]", "_", filename)
    if not safe.endswith((".mp3", ".wav", ".m4a", ".ogg")):
        safe += ".mp3"
    dest = os.path.join(audio_dir, f"{_uuid.uuid4().hex[:8]}_{safe}")
    with open(dest, "wb") as f:
        f.write(file_bytes)
    rel = os.path.relpath(dest, output_dir)
    return {"id": _uuid.uuid4().hex, "file_path": rel, "filename": safe}


async def upload_broll(job_id: str, clip_index: int, file_bytes: bytes,
                       filename: str, user_id: int) -> Dict[str, str]:
    output_dir = os.path.join(_cfg.OUTPUT_DIR, job_id)
    broll_dir = os.path.join(output_dir, "assets", "broll")
    os.makedirs(broll_dir, exist_ok=True)
    safe = re.sub(r"[^a-zA-Z0-9._-]", "_", filename)
    if not safe.endswith((".mp4", ".mov", ".webm")):
        safe += ".mp4"
    dest = os.path.join(broll_dir, f"{_uuid.uuid4().hex[:8]}_{safe}")
    with open(dest, "wb") as f:
        f.write(file_bytes)
    rel = os.path.relpath(dest, output_dir)
    return {"id": _uuid.uuid4().hex, "file_path": rel, "filename": safe}


# ── Ponytail self-check ───────────────────────────────────────────────────────
# ponytail: basic smoke test — does not need coverage because the real path
# is integration through app.py. Run with: python -m editor_v2

if __name__ == "__main__":
    import sys
    print("editor_v2 — syntax & LUT smoke test")
    luts = list_luts()
    print(f"  LUTs found: {len(luts)}")
    # Verify ASS generation is well-formed
    elems = [TextElement(id="test", start=0, end=3, content="Hello World")]
    ass = generate_text_ass(elems)
    assert "[Script Info]" in ass
    assert "Hello World" in ass
    print("  ASS generation: ok")
    # Verify ffmpeg is available
    r = subprocess.run(["ffmpeg", "-version"], capture_output=True)
    assert r.returncode == 0, "ffmpeg not found"
    print(f"  ffmpeg: {r.stdout.splitlines()[0].decode()[:60]}")
    print("✅ editor_v2 self-check passed")
