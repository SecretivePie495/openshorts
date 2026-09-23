import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Word-level transcript slice component (memoized for performance).
const TranscriptChunk = React.memo(function TranscriptChunk({
    items, offset, lit, active, anchorAt, selectedAt, onPick,
}) {
    return (
        <>
            {items.map((w, i) => {
                const inside = lit === 'all'
                    || (lit !== 'none' && w.e > lit.start && w.s < lit.end);
                const isActive = i === active;
                const isSel = i === selectedAt;
                return (
                    <button
                        key={`${w.s}-${offset + i}`}
                        data-anchor={i === anchorAt ? '1' : undefined}
                        data-active={isActive ? '1' : undefined}
                        onClick={() => onPick(w)}
                        title={`${fmt(w.s)} – ${fmt(w.e)}`}
                        className={`px-1 py-0.5 rounded text-xs transition-colors ${
                            isSel ? 'bg-brass text-brassink'
                                : isActive ? 'bg-brass/30 text-ink'
                                    : inside ? 'text-ink hover:bg-paper3'
                                        : 'text-muted hover:bg-paper3'
                        }`}
                    >
                        {w.w}
                    </button>
                );
            })}
        </>
    );
});

function fmt(t) {
    if (!Number.isFinite(t)) return '–:––';
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

const CHUNK_WORDS = 50;

export default function TranscriptPanel({
    words, chunks, activeWordIndex, selectedWordIndex, anchorIndex,
    selectedSeg, highlightSeg,
    pickWord, scrollTranscriptTo,
    snapToWords, setSnapToWords,
    reapplyCaptions, setReapplyCaptions,
    selectedWord,
    selected,
    setSegment,
    fmt,
}) {
    if (!words.length) return null;

    // Build chunks for virtualization
    const memoChunks = useMemo(() => {
        const out = [];
        for (let i = 0; i < words.length; i += CHUNK_WORDS) {
            out.push({ offset: i, items: words.slice(i, i + CHUNK_WORDS) });
        }
        return out;
    }, [words]);

    return (
        <div id="editor-transcript" className="flex flex-col min-h-0 flex-1">
            <div className="flex items-center justify-between mb-2 gap-2 shrink-0">
                <p className="eyebrow">Transcript · full source</p>
                <div className="flex items-center gap-1.5 shrink-0">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={snapToWords}
                            onChange={(e) => setSnapToWords(e.target.checked)}
                            className="sr-only peer"
                        />
                        <span className="relative w-7 h-4 bg-paper3 rounded-full peer-checked:bg-brass/60 transition-colors">
                            <span className="absolute left-0.5 top-0.5 w-3 h-3 bg-ink rounded-full peer-checked:left-[18px] transition-transform" />
                        </span>
                        <span className="readout text-[10px]">snap words</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={reapplyCaptions}
                            onChange={(e) => setReapplyCaptions(e.target.checked)}
                            className="sr-only peer"
                        />
                        <span className="relative w-7 h-4 bg-paper3 rounded-full peer-checked:bg-brass/60 transition-colors">
                            <span className="absolute left-0.5 top-0.5 w-3 h-3 bg-ink rounded-full peer-checked:left-[18px] transition-transform" />
                        </span>
                        <span className="readout text-[10px]">captions</span>
                    </label>
                </div>
            </div>

            {/* Selected word boundary controls */}
            {selectedWord ? (
                <div className="flex items-center gap-1.5 mb-2 shrink-0">
                    <span className="readout text-[10px] text-muted shrink-0">
                        "{selectedWord.w}" ({fmt(selectedWord.s)})
                    </span>
                    <button
                        onClick={() => scrollTranscriptTo(`[data-anchor="${anchorIndex}"]`)}
                        className="btn-quiet text-[11px] py-1 px-2"
                    >
                        segment starts here
                    </button>
                    <button
                        onClick={() => setSegment(selected, { start: selectedWord.s }, { snap: false })}
                        className="btn-quiet text-[11px] py-1 px-2"
                        title={`segment #${selected + 1} starts at "${selectedWord.w}" (${fmt(selectedWord.s)})`}
                    >
                        #{selected + 1} starts
                    </button>
                    <button
                        onClick={() => setSegment(selected, { end: selectedWord.e }, { snap: false })}
                        className="btn-quiet text-[11px] py-1 px-2"
                        title={`segment #${selected + 1} ends after "${selectedWord.w}" (${fmt(selectedWord.e)})`}
                    >
                        #{selected + 1} ends
                    </button>
                </div>
            ) : words.length > 0 ? (
                <span className="readout mb-2 shrink-0">CLICK A WORD, THEN SET BOUNDARY</span>
            ) : null}

            {/* Scrollable word chips */}
            <div
                className="flex-1 min-h-0 flex-wrap content-start gap-x-1 gap-y-1.5 overflow-y-auto custom-scrollbar pr-1"
            >
                {memoChunks.map((c) => {
                    const first = c.items[0].s;
                    const last = c.items[c.items.length - 1].e;
                    let lit = 'none';
                    if (highlightSeg && !(last <= highlightSeg.start || first >= highlightSeg.end)) {
                        lit = (first >= highlightSeg.start && last <= highlightSeg.end)
                            ? 'all' : highlightSeg;
                    }
                    const local = (idx) => (
                        idx >= c.offset && idx < c.offset + c.items.length ? idx - c.offset : -1
                    );
                    return (
                        <TranscriptChunk
                            key={c.offset}
                            items={c.items}
                            offset={c.offset}
                            lit={lit}
                            active={local(activeWordIndex)}
                            anchorAt={local(anchorIndex)}
                            selectedAt={local(selectedWordIndex)}
                            onPick={pickWord}
                        />
                    );
                })}
            </div>
        </div>
    );
}
