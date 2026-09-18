# Overlay library

Drop-in video decorations (particles, light leaks, "like" pop, stickers)
composited over a clip via `overlays.py`. Not bundled with the repo — add your
own here.

## Adding an overlay

1. Drop the video file in this folder (mp4/webm/mov).
2. Add an entry to `manifest.json`:

```json
{
  "id": "particles-gold",
  "title": "Gold Particles",
  "category": "particles",
  "file": "particles-gold.mp4",
  "blend": "screen"
}
```

- `id` — unique, used by the API and the picker.
- `title` — shown in the picker.
- `category` — freeform grouping (e.g. `particles`, `like`, `shockwave`).
- `file` — filename in this folder.
- `blend` — `"screen"` / `"lighten"` / `"add"` for a light-on-black effect clip
  (the common CapCut-pack format — black background, effect drawn in light
  colors). Use `"alpha"` instead if the file already carries a real alpha
  channel (webm/mov exported with transparency).

An entry whose `file` doesn't exist in this folder is skipped by the picker
automatically, so a half-populated manifest is safe.

The overlay is looped to cover the whole clip and auto-scaled to match its
resolution, so a short 1-2s asset works fine on a 30s clip.
