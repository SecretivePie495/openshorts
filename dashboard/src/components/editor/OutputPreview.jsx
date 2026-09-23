import React from 'react';
import { Loader2 } from 'lucide-react';

// 9:16 output preview. The clip track lives in the bottom Timeline.
// Uses existing refs (videoRef, clipTrackRef) and handlers from the engine.

export default function OutputPreview({
    videoRef,
    clipTrackRef,
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
                <div className="h-full max-h-full max-w-[22rem] aspect-[9/16] bg-black rounded-card border border-rule overflow-hidden">
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

        </div>
    );
}
