"""The browser preview and the server render must be the same code.

``dashboard/src/remotion`` drives the in-editor preview (RemotionPreview /
renderInBrowser); ``remotion/src`` is what render-service bundles and burns into
the MP4. They are two hand-maintained copies of one composition set, and they
had already drifted: the preview dimmed inactive karaoke words and forced
uppercase where the server did neither, put the hook at 20%/70% where the server
used 18%/68%, and scaled the outline stroke where the server left it fixed. So
what a user tuned in the editor is not what they downloaded — and every fix
applied to one copy silently missed the other.

Sharing one module would mean building the dashboard image from the repo root
instead of ``dashboard/``, which is a bigger change than this bug is worth. This
test is the cheaper guarantee: the copies stay byte-identical, and the moment
someone edits one, CI says which file and which side.

Editing either copy is fine. Editing only one is the bug.
"""
import pathlib

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
SERVER = ROOT / "remotion" / "src"
PREVIEW = ROOT / "dashboard" / "src" / "remotion"

# Everything the two trees share. remotion/src additionally holds Root.tsx and
# index.ts, which exist only to register the compositions with Remotion Studio
# and have no preview counterpart.
SHARED = [
    "compositions/HookOverlay.tsx",
    "compositions/ShortVideo.tsx",
    "compositions/Subtitles.tsx",
    "compositions/VideoEffects.tsx",
    "lib/captions.ts",
    "lib/fonts.ts",
    "lib/types.ts",
]


@pytest.mark.parametrize("relpath", SHARED)
def test_preview_and_render_use_identical_source(relpath):
    server, preview = SERVER / relpath, PREVIEW / relpath
    if not server.exists() or not preview.exists():
        pytest.skip(f"{relpath} is missing from one tree")

    assert server.read_text() == preview.read_text(), (
        f"{relpath} differs between the render tree and the preview tree.\n"
        f"  render:  {server.relative_to(ROOT)}\n"
        f"  preview: {preview.relative_to(ROOT)}\n"
        "Whatever changed in one has to change in the other, or the editor "
        "stops telling the truth about the final clip."
    )


def test_the_shared_list_covers_both_trees():
    """A new composition added to both trees must join SHARED, or it drifts
    unwatched — which is exactly how the last three got out of step."""
    def tracked(base):
        return {
            str(p.relative_to(base))
            for p in base.rglob("*")
            if p.suffix in (".tsx", ".ts") and p.is_file()
        }

    in_both = tracked(SERVER) & tracked(PREVIEW)
    missing = in_both - set(SHARED)
    assert not missing, (
        f"These files exist in both trees but nothing checks them: {sorted(missing)}. "
        "Add them to SHARED."
    )
