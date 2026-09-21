import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import RemotionPreview from './RemotionPreview';
import Modal from './ui/Modal';

const POSITION_OPTIONS = [
    { value: 'top-left', label: 'Top Left' },
    { value: 'top-right', label: 'Top Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
    { value: 'bottom-right', label: 'Bottom Right' },
];

const PRESET_FRACTIONS = {
    'top-left': { x: 0.15, y: 0.12 },
    'top-right': { x: 0.85, y: 0.12 },
    'bottom-left': { x: 0.15, y: 0.88 },
    'bottom-right': { x: 0.85, y: 0.88 },
};

function loadLogoPrefs() {
    try { return JSON.parse(localStorage.getItem('os_logo_prefs')) || {}; } catch { return {}; }
}

export default function LogoModal({ isOpen, onClose, onGenerate, onRemove, isProcessing, videoUrl, existingSubtitles, hasCaptions, serverRender, burnedLogo }) {
    const prefs = loadLogoPrefs();
    const [position, setPosition] = useState(prefs.position || 'top-right');
    const [scale, setScale] = useState(prefs.scale || 0.5);
    const [opacity, setOpacity] = useState(prefs.opacity || 1.0);
    const [logoUrl, setLogoUrl] = useState(null);
    const [uploadError, setUploadError] = useState(null);
    const fileInputRef = useRef(null);
    const previewRef = useRef(null);
    const draggingRef = useRef(false);
    const [freePos, setFreePos] = useState(null);
    const lastInitial = useRef(null);
    const [showFilePicker, setShowFilePicker] = useState(!!logoUrl);

    useEffect(() => {
        if (isOpen && logoUrl !== lastInitial.current) {
            lastInitial.current = logoUrl;
            setFreePos(null);
        }
    }, [isOpen]);

    const handlePos = freePos || PRESET_FRACTIONS[position] || PRESET_FRACTIONS['top-right'];

    const fractionFromPointer = (clientX, clientY) => {
        const rect = previewRef.current.getBoundingClientRect();
        if (!rect) return { x: 0.85, y: 0.88 };
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

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setUploadError('Please upload an image file (PNG, JPG, etc.)');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setUploadError('Image must be under 10MB');
            return;
        }
        setUploadError(null);
        const reader = new FileReader();
        reader.onload = (evt) => {
            setLogoUrl(evt.target.result);
        };
        reader.onerror = () => setUploadError('Failed to read file');
        reader.readAsDataURL(file);
    };

    const logoConfig = logoUrl ? {
        url: logoUrl,
        position,
        scale,
        opacity,
    } : null;

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" eyebrow="EDITOR · LOGO" title="logo overlay">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Left: Preview */}
                <div ref={previewRef} className="flex-1 flex flex-col items-center justify-center bg-black rounded-card border border-rule overflow-hidden relative aspect-[9/16] max-h-[600px]">
                    {videoUrl ? (
                        <RemotionPreview
                            videoUrl={videoUrl}
                            durationInSeconds={30}
                            hook={null}
                            subtitles={existingSubtitles || null}
                            logo={logoConfig}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted text-sm">
                            Upload a logo to preview
                        </div>
                    )}
                    {/* Free-drag handle: only shown when logo uploaded */}
                    {logoUrl && (
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
                    )}
                </div>

                {/* Right: Controls */}
                <div className="w-full md:w-80 flex flex-col">
                    <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                        {/* File Upload */}
                        <div>
                            <p className="eyebrow mb-2">Logo Image</p>
                            {!showFilePicker ? (
                                <button
                                    onClick={() => setShowFilePicker(true)}
                                    className="w-full py-6 border-2 border-dashed border-rule rounded-input text-muted text-xs hover:border-[color:var(--color-accent)] hover:text-ink2 transition-colors"
                                >
                                    + upload logo (PNG/JPG max 10MB)
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    {logoUrl ? (
                                        <div className="relative aspect-[3/4] rounded-input overflow-hidden border border-rule">
                                            <img src={logoUrl} alt="logo" className="w-full h-full object-contain bg-black" />
                                            <button
                                                type="button"
                                                onClick={() => { setLogoUrl(null); setFreePos(null); }}
                                                className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded hover:bg-black/80"
                                            >
                                                ✕ remove
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full py-4 border-2 border-dashed border-rule rounded-input text-muted text-xs hover:border-[color:var(--color-accent)] hover:text-ink2 transition-colors"
                                        >
                                            choose image file...
                                        </button>
                                    )}
                                    {uploadError && (
                                        <p className="text-[11px] text-warn">{uploadError}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Position Control */}
                        <div>
                            <p className="eyebrow mb-2">Position</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {POSITION_OPTIONS.map((p) => (
                                    <button
                                        key={p.value}
                                        onClick={() => { setPosition(p.value); setFreePos(null); }}
                                        className={`px-2 py-1.5 rounded-input border text-[11px] transition-colors
                                            ${position === p.value && !freePos ? 'border-[color:var(--color-accent)]' : 'border-rule2 hover:border-[color:var(--color-accent)]'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
                                {freePos
                                    ? <>Custom position — drag the handle on the preview to fine-tune, or{' '}
                                        <button type="button" onClick={() => setFreePos(null)} className="underline underline-offset-2 hover:opacity-80">reset to preset</button>.
                                      </>
                                    : 'Or drag the handle on the preview to place it anywhere.'}
                            </p>
                        </div>

                        {/* Scale Control */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="eyebrow">Scale</p>
                                <span className="readout">{scale.toFixed(2)}x</span>
                            </div>
                            <input
                                type="range"
                                min="0.2"
                                max="2.0"
                                step="0.05"
                                value={scale}
                                onChange={(e) => setScale(parseFloat(e.target.value))}
                                className="w-full accent-[var(--color-accent)]"
                            />
                            <div className="flex justify-between">
                                <span className="readout">0.2x</span>
                                <span className="readout">2.0x</span>
                            </div>
                        </div>

                        {/* Opacity Control */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="eyebrow">Opacity</p>
                                <span className="readout">{Math.round(opacity * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={opacity}
                                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                                className="w-full accent-[var(--color-accent)]"
                            />
                            <div className="flex justify-between">
                                <span className="readout">0%</span>
                                <span className="readout">100%</span>
                            </div>
                        </div>

                        {burnedLogo && (
                            <div className="p-3 border border-rule rounded-input text-xs text-muted space-y-2">
                                <p>
                                    This clip has a logo burned in.
                                    Generating replaces it with the new one.
                                </p>
                                {onRemove && (
                                    <button
                                        onClick={onRemove}
                                        disabled={isProcessing}
                                        className="text-warn underline underline-offset-2 hover:opacity-80 transition-opacity"
                                    >
                                        remove logo from clip
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="p-3 border border-rule rounded-input text-xs text-muted">
                            Tip: use PNG with transparency for best results. Avoid busy backgrounds behind your logo.
                        </div>
                    </div>

                    <div className="flex gap-2 mt-5 shrink-0">
                        <button onClick={onClose} className="btn-ghost">
                            cancel
                        </button>
                        <button
                            onClick={() => {
                                try {
                                    localStorage.setItem('os_logo_prefs', JSON.stringify({ position, scale, opacity }));
                                } catch { /* ignore */ }
                                onGenerate({
                                    position,
                                    scale,
                                    opacity,
                                    ...(freePos ? { x_pct: freePos.x, y_pct: freePos.y } : {}),
                                    remotion: logoConfig,
                                });
                            }}
                            disabled={isProcessing || !logoUrl}
                            className="btn-primary flex-1"
                        >
                            {isProcessing && <Loader2 size={16} className="animate-spin text-brassink" />}
                            {isProcessing ? 'generating...' : 'add logo'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
