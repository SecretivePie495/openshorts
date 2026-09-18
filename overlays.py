"""Video overlay library: FFmpeg-composited clip decorations (particles,
light leaks, "like" animations, stickers).

Assets are NOT bundled with the repo — see assets/overlays/README.md for how
to add one. The manifest is read fresh on every call, so dropping in a new
mp4 + a manifest.json entry shows up in the picker immediately.
"""
import json
import os
import subprocess
from pathlib import Path

from ffmpeg_utils import video_encode_args, QUALITY, METADATA_SCRUB

OVERLAY_DIR = Path(__file__).parent / "assets" / "overlays"
MANIFEST_PATH = OVERLAY_DIR / "manifest.json"


def list_overlays():
    if not MANIFEST_PATH.exists():
        return []
    try:
        manifest = json.loads(MANIFEST_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return []
    # Skip entries whose asset never got dropped in (keeps a half-populated
    # manifest from 404ing the picker instead of just hiding that one tile).
    return [o for o in manifest if (OVERLAY_DIR / o.get("file", "")).exists()]


def get_overlay(overlay_id):
    return next((o for o in list_overlays() if o["id"] == overlay_id), None)


def _probe_duration(path):
    out = subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
        timeout=30,
    ).decode().strip()
    return float(out)


def add_overlay_to_video(video_path, overlay_id, output_path):
    """Composite a library overlay onto ``video_path``, looped to cover the
    whole clip. ``blend`` in the manifest picks how the two are combined:
    'screen'/'lighten'/'add' for a light-on-black effect clip (the common
    CapCut-pack format), 'alpha' for a file that already carries a real
    alpha channel (webm/mov).
    """
    overlay = get_overlay(overlay_id)
    if overlay is None:
        raise ValueError(f"unknown overlay: {overlay_id}")
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video {video_path} not found")

    overlay_path = OVERLAY_DIR / overlay["file"]
    blend = overlay.get("blend", "screen")
    duration = _probe_duration(video_path)

    # scale2ref fits the overlay to the base clip's frame size (the library
    # assets are rarely authored at the same resolution as a given source).
    if blend == "alpha":
        filter_complex = "[1:v][0:v]scale2ref[ovl][base];[base][ovl]overlay=shortest=1"
    else:
        filter_complex = (
            "[1:v][0:v]scale2ref[ovl][base];"
            f"[base][ovl]blend=all_mode='{blend}':shortest=1"
        )

    cmd = [
        'ffmpeg', '-y',
        '-i', str(video_path),
        '-stream_loop', '-1', '-i', str(overlay_path),
        '-filter_complex', filter_complex,
        '-map', '0:a?',
        '-t', str(duration),
        '-c:a', 'copy',
        *video_encode_args(QUALITY),
        *METADATA_SCRUB,
        '-movflags', '+faststart',
        str(output_path),
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=1800)
    except subprocess.TimeoutExpired:
        raise RuntimeError("FFmpeg overlay timed out after 1800s.")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(e.stderr.decode() if e.stderr else "ffmpeg overlay failed")
    return True


def demo():
    """ponytail self-check: synth a base clip + a black/white 'flash' overlay,
    composite with screen blend, assert the output exists and is playable."""
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        base = tmp / "base.mp4"
        ovl = tmp / "flash.mp4"
        out = tmp / "out.mp4"
        OVERLAY_DIR.mkdir(parents=True, exist_ok=True)
        manifest_backup = MANIFEST_PATH.read_bytes() if MANIFEST_PATH.exists() else None
        try:
            subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x240:duration=2:rate=24',
                             '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(base)],
                            check=True, capture_output=True, timeout=60)
            subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'color=c=white:size=160x120:duration=1:rate=24',
                             '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(ovl)],
                            check=True, capture_output=True, timeout=60)
            (OVERLAY_DIR / "_demo_flash.mp4").write_bytes(ovl.read_bytes())
            MANIFEST_PATH.write_text(json.dumps([
                {"id": "_demo_flash", "title": "demo", "category": "test", "file": "_demo_flash.mp4", "blend": "screen"},
            ]))
            assert get_overlay("_demo_flash") is not None
            add_overlay_to_video(str(base), "_demo_flash", str(out))
            assert out.exists() and out.stat().st_size > 0
            dur = _probe_duration(out)
            assert 1.8 <= dur <= 2.2, f"expected ~2s output, got {dur}"
            print(f"✅ overlays.demo: composited {out.stat().st_size} bytes, {dur:.2f}s")
        finally:
            (OVERLAY_DIR / "_demo_flash.mp4").unlink(missing_ok=True)
            if manifest_backup is not None:
                MANIFEST_PATH.write_bytes(manifest_backup)
            elif MANIFEST_PATH.exists():
                MANIFEST_PATH.unlink()


if __name__ == "__main__":
    demo()
