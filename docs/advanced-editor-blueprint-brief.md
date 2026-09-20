# Research brief: paste this into ChatGPT for an Advanced Editor blueprint

Copy everything below the line into ChatGPT (or Claude/whatever) and ask it to
produce the blueprint. It's written so the model doesn't have to guess our
stack or reinvent things we already have — it's told what exists, what
doesn't, and where the seams are.

---

## What I'm building

OpenShorts turns long videos into vertical (9:16) short clips. It already has
a working per-clip editor (cut/trim/reorder/reframe). I'm now splitting the
editing experience into two tiers and need a full design blueprint for the
second one:

**Tier 1 — Simple Editor** (already mostly exists, refining it):
- Subtitle style picker with two modes:
  - **Full lines** — a few words on screen at a time (classic caption block)
  - **One word** — a single word on screen, swapped for the next as it's
    spoken (karaoke/TikTok style, but one word at a time, not a highlighted
    phrase)
- **Watermark** — burns the user's own handle/logo onto the clip (not our
  brand mark — their custom one)

**Tier 2 — Advanced Editor** (this is what I need the blueprint for):
- A **full timeline** — the whole clip laid out, not a single-segment view
- A **left sidebar** with these panels:
  - **Effects** — LUTs (color grading presets) + transitions between cuts
  - **Subtitles** — same style system as the Simple Editor, but with manual
    per-line control from the timeline
  - **Text** — freeform text overlays (title cards, callouts), positioned
    and timed independently of subtitles
  - **Audio** — a music/SFX library to drop onto an audio track, plus
    per-clip volume/ducking
  - **Video** — drop in another video clip (B-roll, a second source) as a
    new element on the timeline, not just a recut of the original
  - **Tools** — format/aspect ratio switcher (9:16 / 1:1 / 16:9 / letterbox)
    for an already-generated clip

## What already exists (don't redesign this — build on/around it)

Backend is Python + FFmpeg, frontend is React (Vite). Relevant existing
pieces:

- **Per-clip recut editor** (`ClipEditor.jsx`, React): single-clip NLE —
  source monitor, three-point in/out editing, drag trim/move/split with
  word-snapping, undo/redo, live "coverage" preview (green = already
  rendered, red = needs a re-render), a `framing` override (auto/full-frame/
  track-subject). It edits ONE clip's cut list (an EDL: ordered
  `{start, end}` segments cut from a source video) and calls
  `POST /api/clip/rerender` to re-cut via FFmpeg. There is no multi-track,
  multi-clip, or freeform-overlay concept in it at all — it only manipulates
  which source ranges get concatenated.
- **Subtitles** (`subtitles.py`): burns ASS/SRT captions via FFmpeg.
  Two server-side styles today: `"classic"` (static block, no highlight) and
  `"karaoke"` (multi-word block with the current word highlighted/glowing/
  popping, one dialogue event per word). Params include `max_chars`
  (controls how many words group into one on-screen block),
  `max_duration`, font/color/border/position, an `effect` (none/glow/pop/
  box), and `split_ranges` for split-screen layouts. A literal "one word at a
  time" mode isn't a named style — it's either a config of the existing
  block-grouping logic (small enough `max_chars`) or worth a dedicated
  `words_per_line=1` mode for a clean, guaranteed result. Worth having the
  blueprint treat this as "confirm which approach," not reinvent captioning.
- **Overlays** (`overlays.py` + `assets/overlays/manifest.json`): a library
  of drop-in FFmpeg-composited overlays — full-frame video effects (particle/
  light-leak type, screen/lighten/add/alpha blend) and static bottom-anchored
  image banners. This is the closest existing thing to a "watermark my own
  logo" or "LUT/transition library" system — it's a manifest-driven picker
  already wired to a modal (`OverlayModal.jsx`) and a `POST` apply endpoint.
  No true LUT (3D color lookup table) support and no cut-to-cut transitions
  exist yet — today a "cut" is just a hard concatenation in the EDL.
- **Watermark (current)**: `main.py:apply_watermark` burns ONE fixed brand
  PNG (`assets/watermark.png`) onto free-plan clips at render time, via a
  `WATERMARK=1` env flag per job. It is not user-customizable and not a
  post-hoc toggle — it's baked in during the original render. A "your own
  handle" watermark is a new feature: needs per-account asset upload/storage
  and either reuses the overlay "bottom banner" placement code or a new
  freely-positioned placement.
- **Aspect ratio / format**: exists only as a pipeline-time choice
  (`reframe_v2.py`, `main.py`), selected before the original render:
  vertical (9:16), square (1:1), horizontal (16:9 passthrough), or letterbox
  (16:9 boxed into a 9:16 canvas with black bars). There is no "switch an
  already-rendered clip's aspect ratio" endpoint today — the closest analog
  is `ClipEditor`'s `framing` override, which re-runs the reframe engine on
  the existing cut list. A Tools→Format switcher would need something
  similar: re-run `reframe_v2.render` with a new `aspect_ratio` against the
  clip's existing EDL.
- **No music/SFX library exists anywhere in the codebase.** Audio today is
  only: the original clip audio, and optional ElevenLabs AI dub
  (`translate.py`) that replaces the voice track. A music/SFX panel with
  volume/ducking is a net-new subsystem (asset library + mixing).
- **No true multi-track / multi-clip compositing exists.** Every render is
  fundamentally "one source, cut into ranges, concatenated, optionally
  reframed, optionally captioned." Dropping in a second video as an
  independent timeline element (the "Video" sidebar panel) is the biggest
  architectural jump here — it moves from an EDL (ordered list of ranges cut
  from ONE source) to something closer to a real multi-layer composition
  (primary track + B-roll/overlay tracks + audio tracks with independent
  timing).
- Rendering is server-side FFmpeg batch jobs (`app.py`'s async job queue,
  `MAX_CONCURRENT_JOBS`), not a live client-side compositor. Every edit today
  round-trips to FFmpeg to produce a new preview file (see `ClipEditor`'s
  "coverage" system, built specifically to keep the old preview file playable
  for the parts of the cut that didn't change, since there's no live
  in-browser render).

## What I need from you

Give me a full blueprint for the **Advanced Editor**, specifically:

1. **Data model** — what a "project" needs to look like once it's a real
   multi-track timeline (tracks, clips/elements per track, in/out points,
   z-order, transitions, text/subtitle overlays, audio tracks with
   volume/ducking envelopes). Keep it compatible with "one track can still
   just be the existing EDL" so the simple case doesn't get more expensive.
2. **Rendering strategy** — given today's architecture is "batch FFmpeg job,
   no live compositor," recommend how far to go: (a) keep server-render-only
   with a smarter incremental/partial re-render system like the existing
   coverage tracking, generalized to multiple tracks, vs (b) introduce a
   client-side preview compositor (Canvas/WebGL/WebCodecs) so scrubbing the
   full timeline with effects/text/transitions doesn't require a server
   round-trip for every change, with FFmpeg only doing the final export.
   Give me the tradeoffs plainly (dev cost, latency, fidelity-of-preview vs
   final render, browser compatibility).
3. **Left sidebar panel architecture** — for each of Effects (LUTs +
   transitions), Subtitles, Text, Audio, Video, Tools: what state each panel
   owns, how it writes into the shared timeline data model, and what the
   FFmpeg filtergraph or equivalent needs to do at export time for that
   panel's feature set (e.g., 3D LUT application via `lut3d`/`haldclut`,
   crossfade/wipe transitions via `xfade`, multi-input compositing via
   `overlay`/`amix` for a second video + audio track).
4. **UI/interaction layout** — a wireframe-level description of the timeline
   (tracks, zoom, snapping, selection) and how the sidebar panels attach
   selected elements' properties to a right-hand inspector (or however you'd
   lay it out) — reference the mental model of Premiere/CapCut/DaVinci
   Resolve's timeline since that's the target feel.
5. **Migration/relationship to the existing single-clip editor** — should
   the Advanced Editor replace `ClipEditor.jsx` outright, or sit alongside it
   as an opt-in "pop out to advanced" path from the same clip? What's reused
   vs rebuilt?
6. **Phased roadmap** — order the sub-features (timeline, LUTs, transitions,
   text overlays, music library, B-roll video track, format switcher) by
   implementation cost vs user-facing value, so I can ship incrementally
   instead of building the whole thing before anything ships.

Be concrete: name specific FFmpeg filters, specific libraries/APIs if you
recommend a client-side compositor, and call out anywhere my existing
architecture (EDL + coverage-based partial re-render) will fight the new
multi-track model so I know where the real cost is.
