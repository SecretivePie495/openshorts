import React from 'react';
import { ChevronsRight, ChevronsLeft, X } from 'lucide-react';
import { getApiUrl } from '../../config';

// Source monitor with its track and three-point IN/OUT cluster.
// Reuses existing refs and handlers wholesale from the engine.
export default function SourceMonitor({
    showSource, setShowSource,
    sourceRef, seekSource, applySeek, markHere,
    sourceTime, setSourceTime,
    markIn, setMarkIn, markOut, setMarkOut,
    ghost, setGhost,
    paintNote,
    snapToWords, setSnapToWords,
    sourceDuration, sourceAvailable, canonical,
    markRange, clearMarks, sendToClip, minSeg, selected,
    startTrimDrag, startGhostDrag,
    fmt, edl, segments, maxSegments,
    sourceTrackRef,
    showSourceButton: showSourceButton,
    onToggleSource,
}) {
    if (!showSource || !sourceAvailable) return null;

    return (
        <div className="flex flex-col min-h-0 gap-2">
            <div className="flex items-center justify-between shrink-0">
                <p className="eyebrow">Source · {fmt(sourceDuration)}{edl.source.duration_estimated ? ' (EST.)' : ''}{!sourceAvailable ? ' · EXPIRED' : ''}</p>
                <div className="flex items-center gap-1">
                    <span className="readout hidden sm:inline">
                        DRAG EMPTY SPACE = ADD OR REPLACE · BLOCK TO MOVE · EDGES TO TRIM
                    </span>
                    <button
                        onClick={onToggleSource}
                        title="hide source"
                        aria-label="hide source"
                        className="p-1.5 rounded-input text-muted hover:text-ink hover:bg-paper3 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* 16:9 video */}
            <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center bg-black rounded-card border border-rule overflow-hidden">
                <video
                    ref={sourceRef}
                    src={getApiUrl(edl.source.url)}
                    controls
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={applySeek}
                    onTimeUpdate={(e) => setSourceTime(e.target.currentTime)}
                    className="h-full w-auto max-w-full max-h-full"
                />
            </div>

            {/* Source track */}
            <div className="shrink-0 select-none">
                <div ref={sourceTrackRef}
                    onPointerDown={startGhostDrag}
                    className={`relative h-8 rounded-input border overflow-hidden touch-none ${
                        sourceAvailable
                            ? 'bg-paper border-rule cursor-crosshair'
                            : 'bg-paper border-rule opacity-60'
                    }`}
                >
                    {/* canonical range marker */}
                    {sourceDuration > 0 && (
                        <div
                            className="absolute top-0 bottom-0 border-x border-rule2 bg-paper3/60 pointer-events-none"
                            style={{
                                left: `${(canonical.start / sourceDuration) * 100}%`,
                                width: `${((canonical.end - canonical.start) / sourceDuration) * 100}%`,
                            }}
                        />
                    )}

                    {/* segments as blocks */}
                    {sourceDuration > 0 && segments.map((seg, i) => (
                        <div
                            key={i}
                            onPointerDown={(e) => startTrimDrag(e, i, 'move', sourceTrackRef.current, sourceDuration)}
                            className={`absolute top-1 bottom-1 rounded-[4px] touch-none cursor-grab active:cursor-grabbing ${
                                i === selected ? 'ring-1 ring-[color:var(--color-accent)]' : ''
                            }`}
                            style={{
                                left: `${(seg.start / sourceDuration) * 100}%`,
                                width: `${Math.max(((seg.end - seg.start) / sourceDuration) * 100, 0.4)}%`,
                                background: `oklch(${76 - i * 4}% ${(0.17 - i * 0.02)} ${(50 + i * 30)})`,
                            }}
                        >
                            <span className="absolute inset-0 flex items-center justify-center readout text-[9px] pointer-events-none select-none">
                                #{i + 1} · {fmt(seg.start)}–{fmt(seg.end)}
                            </span>
                            {/* trim handles */}
                            <div
                                onPointerDown={(e) => startTrimDrag(e, i, 'start', sourceTrackRef.current, sourceDuration)}
                                className="absolute left-0 top-0 bottom-0 w-1.5 max-w-[33%] touch-none cursor-ew-resize rounded-l-[4px] bg-ink/35"
                            />
                            <div
                                onPointerDown={(e) => startTrimDrag(e, i, 'end', sourceTrackRef.current, sourceDuration)}
                                className="absolute right-0 top-0 bottom-0 w-1.5 max-w-[33%] touch-none cursor-ew-resize rounded-r-[4px] bg-ink/35"
                            />
                        </div>
                    ))}

                    {/* mark range highlight */}
                    {sourceDuration > 0 && markRange && (
                        <div
                            className="absolute top-0 bottom-0 border-x-2 border-brass bg-brass/15 pointer-events-none"
                            style={{
                                left: `${(markRange.start / sourceDuration) * 100}%`,
                                width: `${((markRange.end - markRange.start) / sourceDuration) * 100}%`,
                            }}
                        />
                    )}

                    {/* individual marks */}
                    {sourceDuration > 0 && !ghost && !markRange && [markIn, markOut].map((t, i) =>
                        t === null ? null : (
                            <div
                                key={i}
                                className="absolute inset-y-0 w-0.5 bg-brass pointer-events-none"
                                style={{ left: `${(t / sourceDuration) * 100}%` }}
                            />
                        )
                    )}

                    {/* source playhead */}
                    {sourceDuration > 0 && (
                        <div
                            className="absolute top-0 bottom-0 w-px bg-ink pointer-events-none"
                            style={{ left: `${(Math.min(sourceTime, sourceDuration) / sourceDuration) * 100}%` }}
                        />
                    )}

                    {/* ghost range preview */}
                    {ghost && sourceDuration > 0 && (
                        <div
                            className="absolute top-1 bottom-1 rounded-[4px] bg-ink/40 border border-dashed border-ink pointer-events-none"
                            style={{
                                left: `${(ghost.start / sourceDuration) * 100}%`,
                                width: `${((ghost.end - ghost.start) / sourceDuration) * 100}%`,
                            }}
                        />
                    )}
                </div>
                <div className="flex justify-between mt-1">
                    <span className="readout">0:00</span>
                    <span className="readout">{fmt(sourceDuration / 2)}</span>
                    <span className="readout">{fmt(sourceDuration)}</span>
                </div>
                {paintNote && (
                    <p className="text-warn mt-1 leading-relaxed text-xs">{paintNote}</p>
                )}
            </div>

            {/* Three-point edit: mark a range on the source, then send it to the clip. */}
            <div className="shrink-0 rounded-input border border-rule bg-paper2 p-2 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                    <button onClick={() => markHere('in')} className="btn-quiet text-[11px] py-1 px-2 flex items-center gap-1 shrink-0">
                        <ChevronsRight size={12} /> in <span className="text-muted">i</span>
                    </button>
                    <button onClick={() => markHere('out')} className="btn-quiet text-[11px] py-1 px-2 flex items-center gap-1 shrink-0">
                        <ChevronsLeft size={12} /> out <span className="text-muted">o</span>
                    </button>
                    <p className={`readout px-1 truncate ${markRange ? 'text-ink' : ''}`}>
                        {markIn === null ? '—:——' : fmt(markIn)}{' → '}{markOut === null ? '—:——' : fmt(markOut)}
                        {markIn !== null && markOut !== null && !markRange && ` · UNDER ${minSeg}S`}
                    </p>
                    <button
                        onClick={clearMarks}
                        disabled={markIn === null && markOut === null}
                        className="ml-auto p-1 rounded-input text-muted hover:text-ink hover:bg-paper3 disabled:opacity-40 shrink-0"
                        aria-label="clear in and out marks"
                    >
                        <X size={13} />
                    </button>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => sendToClip('replace')}
                        disabled={!markRange}
                        title="the selected segment becomes this range (.)"
                        className="btn-primary text-[11px] py-1.5 px-2 disabled:opacity-40"
                    >
                        replace #{selected + 1}
                    </button>
                    <button
                        onClick={() => sendToClip('insert')}
                        disabled={!markRange || segments.length >= maxSegments}
                        title="add this range as a new segment after the selected one (,)"
                        className="btn-quiet text-[11px] py-1.5 px-2 disabled:opacity-40"
                    >
                        insert after #{selected + 1}
                    </button>
                </div>
            </div>
        </div>
    );
}
