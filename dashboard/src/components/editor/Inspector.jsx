import React from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Plus, Redo2, Scissors, Sparkles, Trash2, Undo2 } from 'lucide-react';

// Contextual inspector — segments, framing, toggles, keyboard legend.
export default function Inspector({
    segments, selected, dispatch,
    setSegment, deleteSegment, moveSegment, splitSegment,
    framing, setFraming, renderedFraming,
    snapToWords, setSnapToWords,
    reapplyCaptions, setReapplyCaptions,
    sourceAvailable, outOfRange, addSegment,
    canRender, doRender, rendering, renderSeconds,
    renderError, overCaps,
    fmt, minSeg, total, dirty,
    showEffects, setShowEffects,
    limits,
}) {
    return (
        <div className="flex flex-col min-h-0 w-full xl:w-[22rem] 2xl:w-[26rem] shrink-0">
            <div className="flex-1 xl:overflow-y-auto custom-scrollbar pr-1 space-y-5">

                {/* Segments */}
                <div id="editor-segments" className="scroll-mt-4">
                    <div className="flex items-center justify-between mb-2">
                        <p className="eyebrow">Segments · {segments.length}/{limits?.max_segments}</p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => dispatch && dispatch({ type: 'undo' })}
                                disabled={!dispatch || rendering}
                                title="undo (⌘Z)"
                                className="p-1.5 rounded-input text-muted hover:text-ink hover:bg-paper3 disabled:opacity-30"
                            >
                                <Undo2 size={14} />
                            </button>
                            <button
                                onClick={() => dispatch && dispatch({ type: 'redo' })}
                                disabled={!dispatch || rendering}
                                title="redo (⌘ShiftZ)"
                                className="p-1.5 rounded-input text-muted hover:text-ink hover:bg-paper3 disabled:opacity-30"
                            >
                                <Redo2 size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {segments.map((seg, i) => (
                            <div
                                key={i}
                                onClick={() => dispatch && dispatch({ type: 'select', index: i })}
                                className={`rounded-input border p-2.5 cursor-pointer transition-colors ${
                                    i === selected
                                        ? 'border-[color:var(--color-accent)] bg-paper3'
                                        : 'border-rule2 hover:border-rule'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className="w-4 h-4 rounded-full shrink-0"
                                        style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                                    />
                                    <span className="readout"># {i + 1}</span>
                                    <span>
                                        <TimeInput
                                            value={seg.start}
                                            disabled={rendering}
                                            onCommit={(n) => setSegment(i, { start: n }, { snap: false })}
                                            label={`segment ${i + 1} start`}
                                        />
                                    </span>
                                    <span className="text-muted text-xs">→</span>
                                    <span>
                                        <TimeInput
                                            value={seg.end}
                                            disabled={rendering}
                                            onCommit={(n) => setSegment(i, { end: n }, { snap: false })}
                                            label={`segment ${i + 1} end`}
                                        />
                                    </span>
                                    <span className="readout ml-auto">{fmt(seg.end - seg.start)}</span>
                                </div>
                                <div className="flex items-center gap-1 mt-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); moveSegment(i, -1); }}
                                        disabled={i === 0 || rendering}
                                        title="move segment up (Ctrl+↑)"
                                        className="btn-quiet text-[11px] py-1 px-1.5 disabled:opacity-30"
                                    >
                                        <ChevronUp size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); moveSegment(i, 1); }}
                                        disabled={i === segments.length - 1 || rendering}
                                        title="move segment down (Ctrl+↓)"
                                        className="btn-quiet text-[11px] py-1 px-1.5 disabled:opacity-30"
                                    >
                                        <ChevronDown size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); splitSegment(i); }}
                                        disabled={rendering || segments.length >= (limits?.max_segments || 12) || seg.end - seg.start < minSeg * 2}
                                        title="split segment at playhead (S)"
                                        className="btn-quiet text-[11px] py-1 px-1.5 disabled:opacity-30"
                                    >
                                        <Scissors size={12} /> split
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteSegment(i); }}
                                        disabled={segments.length <= 1 || rendering}
                                        title="delete segment (⌫)"
                                        className="btn-danger text-[11px] py-1 px-1.5 disabled:opacity-30"
                                    >
                                        <Trash2 size={12} /> del
                                    </button>
                                </div>
                                {outOfRange(seg) && (
                                    <p className="text-[11px] text-danger mt-1.5 lowercase">
                                        outside original range — source video expired
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={addSegment}
                        disabled={segments.length >= (limits?.max_segments || 12)}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-input border border-dashed border-rule2 text-xs lowercase text-ink2 hover:bg-paper3 transition-colors disabled:opacity-40"
                    >
                        <Plus size={14} /> add segment
                    </button>
                    {!sourceAvailable && (
                        <p className="text-[11px] text-muted mt-2 leading-relaxed">
                            source video expired — trims limited to original range
                        </p>
                    )}
                </div>

                {/* Framing */}
                <div id="editor-framing" className="scroll-mt-4">
                    <p className="eyebrow mb-2">Framing</p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {[
                            { value: 'auto', label: 'auto', hint: 'AI decides per scene' },
                            { value: 'full', label: 'full frame', hint: 'whole shot, no side-crop' },
                            { value: 'track', label: 'track subject', hint: 'crop follows the person' },
                        ].map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                title={f.hint}
                                disabled={f.value !== 'auto' && !sourceAvailable}
                                onClick={() => setFraming(f.value)}
                                className={`py-1.5 px-2 rounded-input border text-xs lowercase transition-colors ${
                                    framing === f.value
                                        ? 'border-[color:var(--color-accent)] text-ink'
                                        : 'border-rule2 text-muted hover:border-[color:var(--color-accent)]'
                                } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    {!sourceAvailable && (
                        <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
                            framing changes need the source video
                        </p>
                    )}
                    {framing !== renderedFraming && (
                        <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
                            framing change re-runs the reframe engine (slower than fast recut)
                        </p>
                    )}
                </div>

                {/* Toggles */}
                <div className="space-y-2.5">
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-xs lowercase text-ink2">snap cuts to words</span>
                        <span className="relative inline-flex items-center">
                            <input
                                type="checkbox"
                                checked={snapToWords}
                                onChange={(e) => setSnapToWords(e.target.checked)}
                                className="sr-only peer"
                            />
                            <span className="w-7 h-4 bg-paper3 rounded-full peer-checked:bg-brass/60 transition-colors">
                                <span className="absolute left-0.5 top-0.5 w-3 h-3 bg-ink rounded-full peer-checked:left-[18px] transition-transform" />
                            </span>
                        </span>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-xs lowercase text-ink2">re-apply captions after recut</span>
                        <span className="relative inline-flex items-center">
                            <input
                                type="checkbox"
                                checked={reapplyCaptions}
                                onChange={(e) => setReapplyCaptions(e.target.checked)}
                                className="sr-only peer"
                            />
                            <span className="w-7 h-4 bg-paper3 rounded-full peer-checked:bg-brass/60 transition-colors">
                                <span className="absolute left-0.5 top-0.5 w-3 h-3 bg-ink rounded-full peer-checked:left-[18px] transition-transform" />
                            </span>
                        </span>
                    </label>
                </div>

                {/* Keyboard legend */}
                <div id="editor-shortcuts" className="scroll-mt-4">
                    <p className="eyebrow mb-2">Shortcuts</p>
                    <p className="readout leading-relaxed">
                        SPACE PLAY · S SPLIT · ⌫ DELETE · ⌘Z UNDO · ←/→ NUDGE EDGE
                    </p>
                </div>
            </div>

            {/* Footer actions */}
            <div className="shrink-0 pt-4 mt-4 border-t border-rule">
                {renderError && (
                    <div className="mb-3 px-3 py-2 rounded-input text-xs text-danger bg-[color-mix(in_oklab,var(--color-danger)_10%,transparent)] flex items-center gap-2">
                        <AlertCircle size={14} className="shrink-0" /> {renderError}
                    </div>
                )}
                {overCaps && (
                    <p className="mb-3 text-[11px] text-warn lowercase">
                        {total > (limits?.max_total_seconds || 180)
                            ? `clip is over ${Math.round(limits?.max_total_seconds || 180)}s`
                            : `more than ${limits?.max_segments} segments`}
                    </p>
                )}
                <div className="flex gap-2">
                    <button
                        className="btn-ghost"
                        onClick={() => {
                            if (rendering) return;
                            // dirty is handled via onDone / confirm-close in parent
                        }}
                    >
                        {rendering ? 'close' : dirty ? 'cancel' : 'close'}
                    </button>
                    <button
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                        disabled={!canRender || !dirty || rendering}
                        onClick={() => doRender(false)}
                    >
                        {rendering
                            ? (<><Loader2 size={16} className="animate-spin text-brassink" /> re-rendering... {renderSeconds}s</>)
                            : 're-render clip'}
                    </button>
                    <button
                        className="btn-primary flex items-center justify-center gap-2 bg-brass/20 hover:bg-brass/30 disabled:opacity-40"
                        disabled={!canRender || rendering}
                        onClick={() => setShowEffects(true)}
                        title="Apply all effects (LUT, transitions, b-roll, audio, text)"
                    >
                        <Sparkles size={16} />
                        apply effects
                    </button>
                </div>
                {rendering && (
                    <p className="text-[11px] text-muted mt-2 lowercase">
                        you can close this editor; the render keeps going and the clip card updates when it finishes
                    </p>
                )}
            </div>
        </div>
    );
}

// Number input that commits on blur/Enter instead of on every keystroke.
function TimeInput({ value, onCommit, disabled, label }) {
    const [draft, setDraft] = React.useState(null);
    const shown = draft ?? (Number.isFinite(value) ? value : 0);
    const commit = () => {
        if (draft !== null) {
            const n = parseFloat(draft);
            if (Number.isFinite(n)) onCommit(n);
            setDraft(null);
        }
    };
    return (
        <div className="flex flex-col items-center leading-none">
            <input
                type="number"
                step="0.1"
                value={shown}
                disabled={disabled}
                aria-label={label}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { commit(); e.target.blur(); }
                    if (e.key === 'Escape') setDraft(null);
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        if (draft === null) {
                            e.preventDefault();
                            onCommit(Math.round((value + (e.key === 'ArrowUp' ? 0.1 : -0.1)) * 1000) / 1000);
                        }
                    }
                }}
                className="input-field w-20 py-1 px-1.5 text-xs text-center disabled:opacity-40"
            />
            <span className="text-[9px] text-muted mt-0.5 tabular-nums" aria-hidden="true">{fmtInternal(shown)}</span>
        </div>
    );
}

function fmtInternal(t) {
    if (!Number.isFinite(t)) return '–:––';
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

const SEGMENT_COLORS = [
    'oklch(76% .17 50)',
    'oklch(70% .12 200)',
    'oklch(72% .13 140)',
    'oklch(70% .14 300)',
    'oklch(74% .13 90)',
    'oklch(68% .13 250)',
];
