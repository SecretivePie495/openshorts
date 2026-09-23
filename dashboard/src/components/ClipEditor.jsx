import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import useEditorEngine from './editor/useEditorEngine';
import TopBar from './editor/TopBar';
import Timeline from './editor/Timeline';
import LeftNav from './editor/LeftNav';
import SourceMonitor from './editor/SourceMonitor';
import TranscriptPanel from './editor/TranscriptPanel';
import OutputPreview from './editor/OutputPreview';
import Inspector from './editor/Inspector';
import EffectsPanel from './EffectsPanel';

// Night Foundry — compact 3-column editor shell. Left nav, source+transcript,
// program preview, segment/framing/caption inspector. All editing logic lives
// in useEditorEngine; this file is pure composition.

export default function ClipEditor({ jobId, clipIndex, clipTitle, onClose, onRerendered, onRenderQueued }) {
    const engine = useEditorEngine({ jobId, clipIndex, onClose, onRerendered, onRenderQueued });
    const {
        // UI refs
        videoRef, sourceRef, clipTrackRef, sourceTrackRef, transcriptRef,
        // State
        segments, selected, dispatch,
        snapToWords, setSnapToWords,
        reapplyCaptions, setReapplyCaptions,
        framing, setFraming, renderedFraming,
        previewUrl,
        rendering, renderSeconds, renderError,
        confirmClose, setConfirmClose,
        showEffects, setShowEffects,
        selectedWord,
        playhead,
        showSource, setShowSource,
        sourceTime, setSourceTime,
        markIn, setMarkIn, markOut, setMarkOut,
        ghost, setGhost, paintNote,
        // Computed
        words, sourceAvailable, sourceDuration, canonical, minSeg, total,
        sourceOpen, limits, dirty, outOfRange, needsSourcePath,
        overCaps, canRender,
        missingSeconds, coverage, clipTrackSeconds,
        markRange,
        // Actions
        setSegment, addSegment, deleteSegment, moveSegment, splitSegment,
        startTrimDrag, startGhostDrag,
        seekSource, doRender,
        markHere, clearMarks, sendToClip,
        scrollTranscriptTo, pickWord,
        onClipTimeUpdate, onClipSeeked, startClipScrub,
        onClipPlay, onStopPlayback, onEffectsChange, fmt, edl,
        loadError, setReload, applySeek,
        highlightSeg, anchorIndex, activeWordIndex, selectedWordIndex, chunks,
    } = engine;

    const selectedSeg = segments[selected] || null;

    const [activeTab, setActiveTab] = React.useState(null);
    const NAV_TARGETS = { showTranscript: 'editor-transcript', showKeyboard: 'editor-shortcuts' };
    const onNavAction = (action, id) => {
        setActiveTab(id);
        if (action === 'openEffects') { setShowEffects(true); return; }
        const target = NAV_TARGETS[action] || (id === 'framing' || id === 'captions' ? 'editor-framing' : null);
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleClose = () => {
        if (rendering) onClose();
        else if (dirty) setConfirmClose(true);
        else onClose();
    };

    if (loadError) {
        return (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fade" onMouseDown={onClose}>
                <div className="card p-6 max-w-md" onMouseDown={(e) => e.stopPropagation()}>
                    <p className="eyebrow mb-2">EDITOR · CLIP {clipIndex + 1}</p>
                    <div className="flex items-center gap-2 text-danger text-sm"><AlertCircle size={16} /> {loadError}</div>
                    <div className="flex gap-2 mt-5">
                        <button className="btn-ghost" onClick={() => setReload((n) => n + 1)}>retry</button>
                        <button className="btn-primary" onClick={onClose}>close</button>
                    </div>
                </div>
            </div>
        );
    }

    if (!edl) {
        return (
            <div className="fixed inset-0 z-50 bg-paper flex items-center justify-center gap-3 text-muted text-sm lowercase animate-fade">
                <Loader2 size={18} className="animate-spin text-brass" /> loading clip recipe…
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-paper flex flex-col animate-fade select-none">
            {/* Top bar */}
            <TopBar
                clipIndex={clipIndex}
                clipTitle={clipTitle}
                total={fmt(total)}
                fmt={fmt}
                needsSourcePath={needsSourcePath}
                rerenderMinutes={0}
                showSource={showSource}
                sourceAvailable={sourceAvailable}
                confirmClose={confirmClose}
                rendering={rendering}
                onToggleSource={() => setShowSource(v => !v)}
                onConfirmClose={(discard = true) => { setConfirmClose(false); if (discard !== false) onClose(); }}
                onClose={handleClose}
            />

            {/* Main 3-column layout */}
            <div className="flex-1 min-h-0 flex overflow-hidden">

                {/* Left nav toolbar */}
                <LeftNav
                    activeTab={activeTab}
                    onAction={onNavAction}
                    showSource={showSource}
                    setShowSource={setShowSource}
                />

                {/* Column 1: Source monitor + Transcript */}
                <div className={`${sourceOpen ? 'w-[20rem] lg:w-[24rem] xl:w-[26rem] shrink-0' : 'w-[20rem] lg:w-[24rem] shrink-0'} flex flex-col min-h-0 border-r border-rule`}>
                    <div className="flex-1 min-h-0 p-4 overflow-y-auto custom-scrollbar">
                        <SourceMonitor
                            showSource={showSource}
                            setShowSource={setShowSource}
                            sourceRef={sourceRef}
                            applySeek={applySeek}
                            markHere={markHere}
                            seekSource={seekSource}
                            sourceTime={sourceTime}
                            setSourceTime={setSourceTime}
                            markIn={markIn}
                            setMarkIn={setMarkIn}
                            markOut={markOut}
                            setMarkOut={setMarkOut}
                            ghost={ghost}
                            setGhost={setGhost}
                            paintNote={paintNote}
                            snapToWords={snapToWords}
                            setSnapToWords={setSnapToWords}
                            sourceDuration={sourceDuration}
                            sourceAvailable={sourceAvailable}
                            canonical={canonical}
                            markRange={markRange}
                            clearMarks={clearMarks}
                            sendToClip={sendToClip}
                            minSeg={minSeg}
                            selected={selected}
                            startTrimDrag={startTrimDrag}
                            startGhostDrag={startGhostDrag}
                            fmt={fmt}
                            edl={edl}
                            segments={segments}
                            maxSegments={limits.max_segments}
                            sourceTrackRef={sourceTrackRef}
                            showSourceButton={true}
                            onToggleSource={() => setShowSource(v => !v)}
                        />
                        <TranscriptPanel
                            words={words}
                            chunks={chunks}
                            activeWordIndex={activeWordIndex}
                            selectedWordIndex={selectedWordIndex}
                            anchorIndex={anchorIndex}
                            selectedSeg={selectedSeg}
                            highlightSeg={highlightSeg}
                            pickWord={pickWord}
                            scrollTranscriptTo={scrollTranscriptTo}
                            snapToWords={snapToWords}
                            setSnapToWords={setSnapToWords}
                            reapplyCaptions={reapplyCaptions}
                            setReapplyCaptions={setReapplyCaptions}
                            selectedWord={selectedWord}
                            selected={selected}
                            setSegment={setSegment}
                            transcriptRef={transcriptRef}
                            fmt={fmt}
                        />
                    </div>
                </div>

                {/* Column 2: Program preview (center stage) */}
                <div className="flex-1 min-w-0 flex flex-col min-h-0">
                    <div className="flex-1 min-h-0 p-4 flex flex-col">
                        <OutputPreview
                            videoRef={videoRef}
                            previewUrl={previewUrl}
                            fmt={fmt}
                            dirty={dirty}
                            missingSeconds={missingSeconds}
                            rendering={rendering}
                            onClipTimeUpdate={onClipTimeUpdate}
                            onClipSeeked={onClipSeeked}
                            onClipPlay={onClipPlay}
                            onStopPlayback={onStopPlayback}
                        />
                    </div>
                </div>

                {/* Column 3: Inspector (segments / framing / toggles) */}
                <div className="w-[20rem] xl:w-[22rem] 2xl:w-[26rem] shrink-0 flex flex-col min-h-0 border-l border-rule bg-paper">
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                        <Inspector
                            segments={segments}
                            selected={selected}
                            dispatch={dispatch}
                            setSegment={setSegment}
                            deleteSegment={deleteSegment}
                            moveSegment={moveSegment}
                            splitSegment={splitSegment}
                            framing={framing}
                            setFraming={setFraming}
                            renderedFraming={renderedFraming}
                            snapToWords={snapToWords}
                            setSnapToWords={setSnapToWords}
                            reapplyCaptions={reapplyCaptions}
                            setReapplyCaptions={setReapplyCaptions}
                            sourceAvailable={sourceAvailable}
                            outOfRange={outOfRange}
                            addSegment={addSegment}
                            canRender={canRender}
                            doRender={doRender}
                            rendering={rendering}
                            renderSeconds={renderSeconds}
                            renderError={renderError}
                            overCaps={overCaps}
                            fmt={fmt}
                            minSeg={minSeg}
                            total={fmt(total)}
                            dirty={dirty}
                            showEffects={showEffects}
                            setShowEffects={setShowEffects}
                            limits={limits}
                            onClose={handleClose}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom timeline (full width) */}
            <Timeline
                clipTrackRef={clipTrackRef}
                segments={segments}
                words={words}
                coverage={coverage}
                clipTrackSeconds={clipTrackSeconds}
                playhead={playhead}
                selected={selected}
                dispatch={dispatch}
                startClipScrub={startClipScrub}
                startTrimDrag={startTrimDrag}
                splitSegment={splitSegment}
                deleteSegment={deleteSegment}
                rendering={rendering}
                dirty={dirty}
                fmt={fmt}
            />

            {/* Effects panel overlay */}
            {showEffects && (
                <EffectsPanel
                    jobId={jobId}
                    clipIndex={clipIndex}
                    segments={segments}
                    onEffectsChange={onEffectsChange}
                    onClose={() => setShowEffects(false)}
                />
            )}
        </div>
    );
}
