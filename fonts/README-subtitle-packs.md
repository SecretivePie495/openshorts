# Subtitle caption font pack

123 display/caption fonts pulled from a `dafontfree.net` bundle (`Fonts.zip`)
into the subtitle editor's font picker. **Licensing has not been verified per
font** — dafontfree.net mostly redistributes "personal use" / "demo" fonts,
and several filenames say so explicitly (`... PERSONAL USE ONLY`, `...DEMO`).
Shipping OpenShorts is a paid product, so before a real release, check each
font actually used still needs a real commercial license (webfont + app
license, not just "free download") or should be swapped for something OFL
licensed (see `dashboard/public/fonts.css` for how the UI fonts do this).

One file (`Sketch 3D.woff`) is WOFF rather than TTF/OTF; FreeType (what libass
uses to load `fontsdir=`) doesn't reliably support WOFF, so that one font may
silently fail to resolve server-side even though it works fine in the browser
picker/preview. Not converted — fix if that font is actually picked and
confirmed missing from a burned render.

A handful of files shared their embedded family name with another file in the
same pack (e.g. `Dimbo Regular.ttf` / `Dimbo Italic.ttf` both reported family
`Dimbo`). Those had their internal `name` table rewritten (via fontTools) so
every file has a unique family name — otherwise the browser and libass could
each pick either file for a shared name. `QUARTZO` in particular has three
near-duplicate entries because the source zip shipped it three times under
different filenames; not deduped further.

## Where these live

Same 123 files are copied to three places (kept in sync manually, not
symlinked):
- `fonts/` (this dir, flat — **not** a `subtitle-packs/` subdirectory) — used
  by `subtitles.py`'s FFmpeg `ass`/`subtitles` filter `fontsdir=` for the
  server-side ASS burn path. libass's fontsdir scan is not recursive, so a
  subdirectory here would be silently invisible to it and every pack font
  would fall back to DejaVu in burned captions (see
  `openshorts-fontmap.conf`'s comment re. github issue #57 for the same
  failure mode) while still looking correct in the browser preview.
- `dashboard/public/fonts/subtitle-packs/` — served to the browser for the
  live SubtitleModal preview + font-picker dropdown
  (`dashboard/public/subtitle-fonts.css`). Subdirectory is fine here — these
  are addressed by explicit CSS `url()` paths, not directory scanning.
- `remotion/public/fonts/subtitle-packs/` — used by `render-service`'s
  server-side Remotion render (`remotion/src/lib/fonts.ts`'s
  `subtitlePackFontFace`, via `staticFile()`). Same reasoning: explicit paths,
  subdirectory is fine.

Family name -> filename mapping is generated, not hand-written; see
`SUBTITLE_PACK` font entries in `dashboard/src/remotion/lib/fonts.ts` /
`remotion/src/lib/fonts.ts` for the canonical list.
