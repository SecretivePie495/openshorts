import React from 'react';
import { Scissors, Trash2, Undo2, Redo2 } from 'lucide-react';

// Full-width bottom timeline: toolbar, ruler, video track (segments with trim
// handles, the old clip track) and a captions track built from the transcript.
const SEGMENT_COLORS = [
    'oklch(76% .17 50)',
    'oklch(70% .12 200)',
    'oklch(72% .13 140)',
    'oklch(70% .14 300)',
    'oklch(74% .13 90)',
    'oklch(68% .13 250)',
];
const WORDS_PER_CAPTION = 5;

export default function Timeline({
    clipTrackRef, segments, words, coverage, clipTrackSeconds, playhead,
    selected, dispatch, startClipScrub, startTrimDrag,
    splitSegment, deleteSegment, rendering, dirty, fmt,
}) {
    const pct = (t) => `${(t / clipTrackSeconds) * 100}%`;

    const blocks = React.useMemo(() => {
        let offset = 0;
        return segments.map((seg, i) => {
            const b = { seg, i, start: offset };
            offset += seg.end - seg.start;
            return b;
        });
    }, [segments]);

    // Source-time words -> clip-time caption chunks, per segment.
    const captions = React.useMemo(() => {
        const out = [];
        for (const { seg, start } of blocks) {
            const inSeg = words.filter((w) => w.s >= seg.start && w.e <= seg.end);
            for (let k = 0; k < inSeg.length; k += WORDS_PER_CAPTION) {
                const group = inSeg.slice(k, k + WORDS_PER_CAPTION);
                out.push({
                    start: start + (group[0].s - seg.start),
                    end: start + (group[group.length - 1].e - seg.start),
                    text: group.map((w) => w.w ?? w.word ?? w.text ?? '').join(' '),
                });
            }
        }
        return out;
    }, [blocks, words]);

    const ticks = React.useMemo(() => {
        const step = clipTrackSeconds > 120 ? 15 : clipTrackSeconds > 40 ? 5 : 2;
        const out = [];
        for (let t = 0; t <= clipTrackSeconds; t += step) out.push(t);
        return out;
    }, [clipTrackSeconds]);

    const toolBtn = 'flex items-center gap-1.5 px-2 py-1 rounded-input text-xs lowercase text-ink2 hover:text-ink hover:bg-paper3 disabled:opacity-30';
    const playheadLeft = pct(Math.min(playhead, clipTrackSeconds));

    return (
        <div className="shrink-0 border-t border-rule bg-paper select-none">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-rule">
                <button className={toolBtn} disabled={rendering} onClick={() => splitSegment(selected)} title="split at playhead (S)">
                    <Scissors size={14} /> split
                </button>
                <button className={toolBtn} disabled={rendering || segments.length < 2} onClick={() => deleteSegment(selected)} title="delete segment (⌫)">
                    <Trash2 size={14} /> delete
                </button>
                <button className={toolBtn} disabled={rendering} onClick={() => dispatch({ type: 'undo' })} title="undo (⌘Z)">
                    <Undo2 size={14} />
                </button>
                <button className={toolBtn} disabled={rendering} onClick={() => dispatch({ type: 'redo' })} title="redo (⌘⇧Z)">
                    <Redo2 size={14} />
                </button>
                <span className="readout ml-auto">{fmt(playhead)} / {fmt(clipTrackSeconds)}</span>
            </div>

            <div className="flex px-3 py-2 gap-2">
                {/* Track labels */}
                <div className="w-16 shrink-0 flex flex-col text-[11px] lowercase text-muted">
                    <div className="h-5" />
                    <div className="h-14 flex items-center">video</div>
                    <div className="h-8 flex items-center">captions</div>
                </div>

                <div className="relative flex-1 min-w-0">
                    {/* Ruler */}
                    <div className="relative h-5">
                        {ticks.map((t) => (
                            <span key={t} className="absolute readout text-[10px] -translate-x-1/2" style={{ left: pct(t) }}>
                                {fmt(t)}
                            </span>
                        ))}
                    </div>

                    {/* Video track (scrub + trim) */}
                    <div
                        ref={clipTrackRef}
                        onPointerDown={startClipScrub}
                        className="relative h-14 rounded-input bg-paper2 border border-rule overflow-hidden touch-none cursor-pointer"
                    >
                        {blocks.map(({ seg, i, start }) => {
                            const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
                            return (
                                <div
                                    key={i}
                                    onPointerDown={() => dispatch({ type: 'select', index: i })}
                                    className={`absolute top-1 bottom-1 rounded-[6px] border ${i === selected ? 'border-[color:var(--color-accent)]' : 'border-transparent'}`}
                                    style={{ left: pct(start), width: pct(seg.end - seg.start), background: `color-mix(in oklab, ${color} 28%, transparent)` }}
                                >
                                    <span className="absolute inset-0 flex items-center justify-center readout pointer-events-none">
                                        #{i + 1} · {fmt(seg.end - seg.start)}
                                    </span>
                                    <div
                                        onPointerDown={(e) => startTrimDrag(e, i, 'start', clipTrackRef.current, clipTrackSeconds)}
                                        className="absolute left-0 top-0 bottom-0 w-2 touch-none cursor-ew-resize rounded-l-[6px]"
                                        style={{ background: color }}
                                    />
                                    <div
                                        onPointerDown={(e) => startTrimDrag(e, i, 'end', clipTrackRef.current, clipTrackSeconds)}
                                        className="absolute right-0 top-0 bottom-0 w-2 touch-none cursor-ew-resize rounded-r-[6px]"
                                        style={{ background: color }}
                                    />
                                </div>
                            );
                        })}
                        {dirty && coverage.map((sp, i) => (
                            <div
                                key={i}
                                className={`absolute top-0 h-1 pointer-events-none ${sp.rendered === null ? 'bg-danger' : 'bg-ok/50'}`}
                                style={{ left: pct(sp.start), width: pct(sp.end - sp.start) }}
                            />
                        ))}
                    </div>

                    {/* Captions track */}
                    <div className="relative h-8 mt-1 rounded-input bg-paper2 border border-rule overflow-hidden">
                        {captions.map((c, i) => (
                            <div
                                key={i}
                                title={c.text}
                                className="absolute top-1 bottom-1 rounded-[4px] bg-[color:var(--color-accent)]/25 px-1 text-[10px] leading-6 text-ink truncate"
                                style={{ left: pct(c.start), width: pct(Math.max(c.end - c.start, 0.2)) }}
                            >
                                {c.text}
                            </div>
                        ))}
                    </div>

                    {/* Playhead across all tracks */}
                    <div className="absolute top-5 bottom-0 w-px bg-ink pointer-events-none" style={{ left: playheadLeft }}>
                        <div className="absolute -top-1 -left-[5px] w-[11px] h-2 rounded-sm bg-ink" />
                    </div>
                </div>
            </div>
        </div>
    );
}
