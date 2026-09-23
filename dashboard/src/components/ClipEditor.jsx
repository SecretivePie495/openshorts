import React, { useMemo, useCallback } from 'react';
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
        framing, setFraming, renderedFraming, setRenderedFraming,
        renderedSegments, setRenderedSegments,
        previewUrl,
        rendering, renderSeconds, renderError,
        confirmClose, setConfirmClose,
        showEffects, setShowEffects, effectsState, setEffectsState,
        selectedWord, setSelectedWord,
        playhead, setPlayhead,
        showSource, setShowSource,
        sourceTime, setSourceTime,
        markIn, setMarkIn, markOut, setMarkOut,
        ghost, setGhost, paintNote,
        // Computed
        words, sourceAvailable, sourceDuration, canonical, minSeg, total,
        sourceOpen, limits, dirty, outOfRange, needsSourcePath,
        invalidSegments, overCaps, canRender,
        missingSeconds, coverage, clipTrackSeconds,
        markRange,
        // Actions
        setSegment, addSegment, deleteSegment, moveSegment, splitSegment,
        startTrimDrag, startGhostDrag,
        seekSource, doRender,
        markHere, clearMarks, sendToClip,
        scrollTranscriptTo, pickWord,
        onClipTimeUpdate, onClipSeeked, startClipScrub,
        onClipPlay, onStopPlayback, onVideoLoadedMetadata, onEffectsChange,        fmt, edl,
    } = engine;

    // Recompute on each edit so the top-bar always shows a fresh duration.
    const [nowTotal, setNowTotal] = React.useState(total);
    React.useEffect(() => { setNowTotal(total); }, [total]);

    // Recomputed transcript indices — mirror what the engine computes internally.
    const selectedSeg = segments[selected] || null;
    const highlightSeg = selectedSeg;
    const anchorIndex = useMemo(() =>
        selectedSeg ? words.findIndex((w) => w.e > selectedSeg.start) : -1,
        [words, selectedSeg]
    );
    const activeWordIndex = useMemo(() => {
        let lo = 0, hi = words.length - 1, best = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (words[mid].s <= sourceTime) { best = mid; lo = mid + 1; } else hi = mid - 1;
        }
        return best;
    }, [words, sourceTime]);
    const selectedWordIndex = useMemo(() =>
        selectedWord ? words.findIndex((w) => w.s === selectedWord.s && w.e === selectedWord.e) : -1,
        [words, selectedWord]
    );
    const chunks = useMemo(() => {
        const out = [];
        for (let i = 0; i < words.length; i += 50) {
            out.push({ offset: i, items: words.slice(i, i + 50) });
        }
        return out;
    }, [words]);

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

    return (
        <div className="fixed inset-0 z-50 bg-paper flex flex-col animate-fade select-none">
            {/* Top bar */}
            <TopBar
                clipIndex={clipIndex}
                clipTitle={clipTitle}
                total={fmt(nowTotal)}
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
                            playhead={playhead}
                            setPlayhead={setPlayhead}
                            renderedSegments={renderedSegments}
                            segments={segments}
                            coverage={coverage}
                            clipTrackSeconds={clipTrackSeconds}
                            onClipTimeUpdate={onClipTimeUpdate}
                            onClipSeeked={onClipSeeked}
                            startClipScrub={startClipScrub}
                            dispatch={dispatch}
                            startTrimDrag={startTrimDrag}
                            fmt={fmt}
                            total={fmt(nowTotal)}
                            dirty={dirty}
                            missingSeconds={missingSeconds}
                            rendering={rendering}
                            canRender={canRender}
                            doRender={doRender}
                            selected={selected}
                            showEffects={showEffects}
                            setShowEffects={setShowEffects}
                            renderError={renderError}
                            overCaps={overCaps}
                            needsSourcePath={needsSourcePath}
                            renderSeconds={renderSeconds}
                            limits={limits}
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
                            total={fmt(nowTotal)}
                            dirty={dirty}
                            showEffects={showEffects}
                            setShowEffects={setShowEffects}
                            limits={limits}
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
