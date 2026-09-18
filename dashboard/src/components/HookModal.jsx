import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import RemotionPreview from './RemotionPreview';
import Modal from './ui/Modal';
import SegmentedControl from './ui/SegmentedControl';

const ENTRANCE_OPTIONS = [
    { value: 'spring', label: 'Bounce' },
    { value: 'fade', label: 'Fade' },
    { value: 'slide-up', label: 'Slide Up' },
    { value: 'none', label: 'None' },
];

// Must mirror hooks.py HOOK_STYLES.
const HOOK_STYLES = [
    { value: 'classic', label: 'Classic', box: 'rgba(255,255,255,0.94)', text: '#000' },
    { value: 'dark', label: 'Dark', box: 'rgba(18,18,20,0.92)', text: '#fff' },
    { value: 'yellow', label: 'Yellow', box: 'rgba(255,214,0,0.96)', text: '#000' },
    { value: 'red', label: 'Red', box: 'rgba(220,38,38,0.96)', text: '#fff' },
    { value: 'outline', label: 'Outline', box: 'transparent', text: '#fff', outline: true },
    { value: 'outline_yellow', label: 'Outline+', box: 'transparent', text: '#FFD600', outline: true },
];

const POSITION_OPTIONS = [
    { value: 'top', label: 'top' },
    { value: 'center', label: 'center' },
    { value: 'bottom', label: 'bottom' },
];

const SIZE_OPTIONS = [
    { value: 'S', label: 'Small' },
    { value: 'M', label: 'Medium' },
    { value: 'L', label: 'Large' },
];

// Fallback anchor for the drag handle before the user has dragged at all.
const PRESET_FRACTIONS = {
    top: { x: 0.5, y: 0.2 },
    center: { x: 0.5, y: 0.5 },
    bottom: { x: 0.5, y: 0.75 },
};

// Last-used hook settings, restored on the next open (style always reset to
// classic otherwise, which users read as the picker being broken).
function loadHookPrefs() {
    try { return JSON.parse(localStorage.getItem('os_hook_prefs')) || {}; } catch { return {}; }
}

export default function HookModal({ isOpen, onClose, onGenerate, onRemove, isProcessing, videoUrl, initialText, durationInSeconds, existingSubtitles, hasCaptions, serverRender, burnedHook }) {
    const prefs = loadHookPrefs();
    const [text, setText] = useState(initialText || 'POV: You are using the viral hook feature');
    // The modal stays mounted behind `isOpen`: without this, reopening it
    // after an edit (or on another clip) showed the PREVIOUS clip's text and
    // the previous clip's drag position. Re-sync on open with new content.
    const lastInitial = useRef(null);
    useEffect(() => {
        if (isOpen && initialText !== lastInitial.current) {
            lastInitial.current = initialText;
            if (initialText) setText(initialText);
            setFreePos(null);
        }
    }, [isOpen, initialText]);
    const [position, setPosition] = useState(prefs.position || 'top');
    const [size, setSize] = useState(prefs.size || 'M');
    const [style, setStyle] = useState(prefs.style || 'classic');
    const [entranceAnimation, setEntranceAnimation] = useState(prefs.entranceAnimation || 'spring');
    const [displayDuration, setDisplayDuration] = useState(5);
    // Free-drag center point (0-1 fractions). null = use the top/center/bottom preset.
    const [freePos, setFreePos] = useState(prefs.freePos || null);
    const previewRef = useRef(null);
    const draggingRef = useRef(false);
    const look = HOOK_STYLES.find((st) => st.value === style) || HOOK_STYLES[0];
    const getSizeStyle = () => {
        switch (size) {
            case 'S': return { fontSize: '14px', maxWidth: '80%' };
            case 'L': return { fontSize: '24px', maxWidth: '95%' };
            case 'M': default: return { fontSize: '18px', maxWidth: '90%' };
        }
    };
    // The preview must show the CHOSEN look — the old hardcoded white card
    // made toggling style and starting a drag both "change the format", so
    // the picker felt broken. Outline looks lose the card entirely.
    const previewCard = {
        ...getSizeStyle(),
        backgroundColor: look.box,
        color: look.text,
        fontFamily: 'Noto Serif, serif',
        fontWeight: 700,
        textShadow: look.outline
            ? '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
            : 'none',
        boxShadow: look.outline ? 'none' : '0 4px 15px rgba(0,0,0,0.5)',
        borderRadius: look.outline ? 0 : '12px',
        padding: look.outline ? '0' : '10px 12px',
    };

    if (!isOpen) return null;

    const handlePos = freePos || PRESET_FRACTIONS[position] || PRESET_FRACTIONS.top;

    const fractionFromPointer = (clientX, clientY) => {
        const rect = previewRef.current.getBoundingClientRect();
        return {
            x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
            y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
        };
    };

    const handleDragStart = (e) => {
        e.preventDefault();
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    const handleDragMove = (e) => {
        if (!draggingRef.current) return;
        setFreePos(fractionFromPointer(e.clientX, e.clientY));
    };
    const handleDragEnd = () => {
        draggingRef.current = false;
    };

    // Build hook config for Remotion preview
    const hookConfig = {
        text: text || 'Enter your text...',
        position,
        size,
        style,
        entranceAnimation,
        displayDurationSec: displayDuration,
        ...(freePos ? { xPct: freePos.x, yPct: freePos.y } : {}),
    };

    const useRemotionPreview = !!videoUrl;

    // Fallback preview logic (same as original)
    const getPositionClass = () => {
        switch (position) {
            case 'center': return 'items-center justify-center';
            case 'bottom': return 'items-center justify-end pb-[20%]';
            case 'top': default: return 'items-center justify-start pt-[20%]';
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" eyebrow="EDITOR · HOOK" title="viral hook">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Left: Preview */}
                <div ref={previewRef} className="flex-1 flex flex-col items-center justify-center bg-black rounded-card border border-rule overflow-hidden relative aspect-[9/16] max-h-[600px]">
                    {useRemotionPreview ? (
                        <RemotionPreview
                            videoUrl={videoUrl}
                            durationInSeconds={durationInSeconds || 30}
                            hook={hookConfig}
                            subtitles={existingSubtitles || null}
                        />
                    ) : (
                        <>
                            <video src={videoUrl} className="w-full h-full object-contain opacity-50" muted playsInline />
                            {freePos ? (
                                <div
                                    className="absolute px-8 text-center pointer-events-none"
                                    style={{ left: `${freePos.x * 100}%`, top: `${freePos.y * 100}%`, transform: 'translate(-50%, -50%)' }}
                                >
                                    <div
                                        className="text-center whitespace-pre-wrap"
                                        style={previewCard}
                                    >
                                        {text || "Enter your text..."}
                                    </div>
                                </div>
                            ) : (
                                <div className={`absolute w-full px-8 text-center transition-all duration-300 pointer-events-none flex flex-col h-full ${getPositionClass()}`}>
                                    <div
                                        className="text-center whitespace-pre-wrap"
                                        style={previewCard}
                                    >
                                        {text || "Enter your text..."}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {/* Free-drag handle: drag anywhere on the frame to reposition the hook. */}
                    <div
                        onPointerDown={handleDragStart}
                        onPointerMove={handleDragMove}
                        onPointerUp={handleDragEnd}
                        style={{
                            position: 'absolute',
                            left: `${handlePos.x * 100}%`,
                            top: `${handlePos.y * 100}%`,
                            transform: 'translate(-50%, -50%)',
                            cursor: 'grab',
                            zIndex: 20,
                            padding: '4px 8px',
                            borderRadius: 999,
                            background: 'rgba(0,0,0,0.55)',
                            border: '1px dashed rgba(255,255,255,0.7)',
                            color: '#fff',
                            fontSize: 10,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            touchAction: 'none',
                            userSelect: 'none',
                        }}
                    >
                        ⠿ drag
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="w-full md:w-80 flex flex-col">
                    <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                        {/* Text Input */}
                        <div>
                            <p className="eyebrow mb-2">Text</p>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                rows={4}
                                className="input-field resize-none font-serif"
                                style={{ fontFamily: 'Noto Serif, serif' }}
                                placeholder="Enter text that will stop the scroll..."
                            />
                        </div>

                        {/* Style (new) */}
                        <div>
                            <p className="eyebrow mb-2">Style</p>
                            <div className="grid grid-cols-3 gap-1.5">
                                {HOOK_STYLES.map((s) => (
                                    <button
                                        key={s.value}
                                        onClick={() => setStyle(s.value)}
                                        className={`px-1 py-2 rounded-input border text-xs transition-colors
                                            ${style === s.value ? 'border-[color:var(--color-accent)]' : 'border-rule2 hover:border-[color:var(--color-accent)]'}`}
                                        title={s.label}
                                    >
                                        <span
                                            className="block rounded px-1 py-1 font-bold"
                                            style={{
                                                backgroundColor: s.box,
                                                color: s.text,
                                                textShadow: s.outline ? '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' : 'none',
                                            }}
                                        >Aa</span>
                                        <span className="block mt-1 text-muted">{s.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Position Control */}
                        <div>
                            <p className="eyebrow mb-2">Position</p>
                            <SegmentedControl
                                options={POSITION_OPTIONS}
                                value={position}
                                onChange={(v) => { setPosition(v); setFreePos(null); }}
                                size="sm"
                            />
                            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
                                {freePos
                                    ? <>Custom position — drag the handle on the preview to fine-tune, or{' '}
                                        <button type="button" onClick={() => setFreePos(null)} className="underline underline-offset-2 hover:opacity-80">reset to preset</button>.
                                      </>
                                    : 'Or drag the handle on the preview to place it anywhere.'}
                            </p>
                            {position === 'bottom' && !freePos && hasCaptions && (
                                <p className="text-[11px] text-warn mt-1.5 leading-relaxed">
                                    This clip has captions near the bottom — the hook may
                                    overlap them (and TikTok's UI). Top is the safe zone.
                                </p>
                            )}
                        </div>

                        {/* Size Control */}
                        <div>
                            <p className="eyebrow mb-2">Size</p>
                            <SegmentedControl
                                options={SIZE_OPTIONS}
                                value={size}
                                onChange={setSize}
                                size="sm"
                            />
                        </div>

                        {/* Entrance Animation (new) */}
                        <div className={serverRender ? 'opacity-50' : ''}>
                            <p className="eyebrow mb-2">Entrance</p>
                            <SegmentedControl
                                options={ENTRANCE_OPTIONS}
                                value={entranceAnimation}
                                onChange={setEntranceAnimation}
                                columns={2}
                                size="sm"
                            />
                            {serverRender && (
                                <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
                                    This clip re-renders on the server, where the hook is
                                    static — the entrance animation won't apply.
                                </p>
                            )}
                        </div>

                        {/* Display Duration (new) */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="eyebrow">Duration</p>
                                <span className="readout">{displayDuration}S</span>
                            </div>
                            <input
                                type="range"
                                min="2"
                                max="15"
                                value={displayDuration}
                                onChange={(e) => setDisplayDuration(parseInt(e.target.value))}
                                className="w-full accent-[var(--color-accent)]"
                            />
                            <div className="flex justify-between">
                                <span className="readout">2S</span>
                                <span className="readout">15S</span>
                            </div>
                        </div>

                        {burnedHook && (
                            <div className="p-3 border border-rule rounded-input text-xs text-muted space-y-2">
                                <p>
                                    This clip has a hook burned in ("{burnedHook}").
                                    Generating replaces it with the new one.
                                </p>
                                {onRemove && (
                                    <button
                                        onClick={onRemove}
                                        disabled={isProcessing}
                                        className="text-warn underline underline-offset-2 hover:opacity-80 transition-opacity"
                                    >
                                        remove hook from clip
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="p-3 border border-rule rounded-input text-xs text-muted">
                            Tip: keep it short and punchy. Using "POV:" or specific questions works best for retention.
                        </div>
                    </div>

                    <div className="flex gap-2 mt-5 shrink-0">
                        <button onClick={onClose} className="btn-ghost">
                            cancel
                        </button>
                        <button
                            onClick={() => {
                                try {
                                    localStorage.setItem('os_hook_prefs', JSON.stringify({
                                        style, position, size, entranceAnimation, freePos,
                                    }));
                                } catch { /* ignore */ }
                                onGenerate({
                                    text, position, size, style,
                                    x_pct: freePos?.x,
                                    y_pct: freePos?.y,
                                    // Remotion data
                                    remotion: hookConfig,
                                });
                            }}
                            disabled={isProcessing || !text.trim()}
                            className="btn-primary flex-1"
                        >
                            {isProcessing && <Loader2 size={16} className="animate-spin text-brassink" />}
                            {isProcessing ? 'generating...' : 'add hook'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
