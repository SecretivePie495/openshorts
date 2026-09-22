import React from 'react';
import { Loader2 } from 'lucide-react';

// 9:16 output preview with clip track underneath.
// Uses existing refs (videoRef, clipTrackRef) and handlers from the engine.
const SEGMENT_COLORS = [
    'oklch(76% .17 50)',
    'oklch(70% .12 200)',
    'oklch(72% .13 140)',
    'oklch(70% .14 300)',
    'oklch(74% .13 90)',
    'oklch(68% .13 250)',
];

export default function OutputPreview({
    videoRef,
    previewUrl,
    playhead,
    setPlayhead,
    renderedSegments,
    segments,
    coverage,
    clipTrackSeconds,
    onClipTimeUpdate,
    onClipSeeked,
    startClipScrub,
    dispatch,
    startTrimDrag,
    fmt,
    total,
    dirty,
    missingSeconds,
    rendering,
    canRender,
    doRender,
    selected,
    showEffects,
    setShowEffects,
    renderError,
    overCaps,
    needsSourcePath,
    renderSeconds,
    limits,
    onClipPlay,
    onStopPlayback,
}) {
    // Build block positions for the clip track
    const blocks = React.useMemo(() => {
        if (!segments.length) return [];
        let runningOffset = 0;
        return segments.map((s, i) => {
            const left = (runningOffset / clipTrackSeconds) * 100;
            const width = ((s.end - s.start) / clipTrackSeconds) * 100;
            runningOffset += s.end - s.start;
            return { seg: s, i, left, width };
        });
    }, [segments, clipTrackSeconds]);

    return (
        <div className="flex flex-col min-h-0 flex-1">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 shrink-0">
                <p className="eyebrow">Program</p>
                <div className="flex items-center gap-2">
                    {rendering && (
                        <span className="readout text-brass">RENDER IN PROGRESS · EDITING LOCKED</span>
                    )}
                    {dirty && (
                        <span className="badge-warn">
                            {missingSeconds > 0.02
                                ? `${fmt(missingSeconds)} not rendered yet`
                                : 'previewing edit · re-render to keep it'}
                        </span>
                    )}
                </div>
            </div>

            {/* 9:16 video */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="h-full max-h-full aspect-[9/16] bg-black rounded-card border border-rule overflow-hidden">
                    <video
                        ref={videoRef}
                        src={previewUrl}
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                        onTimeUpdate={onClipTimeUpdate}
                        onSeeked={onClipSeeked}
                        onPlay={onClipPlay}
                        onPause={onStopPlayback}
                    />
                </div>
            </div>

            {/* Clip track */}
            <div className="shrink-0 select-none">
                <div className="flex items-center justify-between mb-1.5 gap-3">
                    <p className="readout">CLIP · {fmt(total)}</p>
                </div>
                <div
                    ref={clipTrackRef}
                    onPointerDown={startClipScrub}
                    className="relative h-12 rounded-input bg-paper border border-rule overflow-hidden touch-none cursor-pointer"
                >
                    {/* Segment blocks */}
                    {blocks.map(({ seg, i, left, width }) => (
                        <div
                            key={i}
                            onPointerDown={() => dispatch({ type: 'select', index: i })}
                            className={`absolute top-1 bottom-1 rounded-[6px] border ${
                                i === selected
                                    ? 'border-[color:var(--color-accent)]'
                                    : 'border-transparent'
                            }`}
                            style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                background: `color-mix(in oklab, ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} 28%, transparent)`,
                            }}
                        >
                            <span className="absolute inset-0 flex items-center justify-center readout pointer-events-none select-none">
                                #{i + 1} · {fmt(seg.end - seg.start)}
                            </span>
                            {/* Trim handles */}
                            <div
                                onPointerDown={(e) => startTrimDrag(e, i, 'start', clipTrackRef.current, clipTrackSeconds)}
                                className="absolute left-0 top-0 bottom-0 w-2 touch-none cursor-ew-resize rounded-l-[6px]"
                                style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                            />
                            <div
                                onPointerDown={(e) => startTrimDrag(e, i, 'end', clipTrackRef.current, clipTrackSeconds)}
                                className="absolute right-0 top-0 bottom-0 w-2 touch-none cursor-ew-resize rounded-r-[6px]"
                                style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                            />
                        </div>
                    ))}

                    {/* Coverage overlay */}
                    {dirty && coverage.map((sp, i) => (
                        <div
                            key={i}
                            className={`absolute top-0 h-1 pointer-events-none ${
                                sp.rendered === null ? 'bg-danger' : 'bg-ok/50'
                            }`}
                            style={{
                                left: `${(sp.start / clipTrackSeconds) * 100}%`,
                                width: `${((sp.end - sp.start) / clipTrackSeconds) * 100}%`,
                            }}
                        />
                    ))}

                    {/* Playhead scrubber */}
                    <div
                        className="absolute top-1 bottom-1 w-2.5 -ml-[5px] rounded-[4px] bg-ink border border-paper cursor-grab active:cursor-grabbing pointer-events-none"
                        style={{ left: `${(Math.min(playhead, clipTrackSeconds) / clipTrackSeconds) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
