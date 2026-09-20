import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { getApiUrl } from '../config';
import { apiFetch } from '../lib/api';
import Modal from './ui/Modal';

export default function OverlayModal({ isOpen, onClose, onApply, onRemove, isProcessing, videoUrl, burnedOverlay }) {
    const [overlaysList, setOverlaysList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(burnedOverlay?.overlay_id || null);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        apiFetch('/api/overlays')
            .then((res) => (res.ok ? res.json() : { overlays: [] }))
            .then((data) => setOverlaysList(data.overlays || []))
            .catch(() => setOverlaysList([]))
            .finally(() => setLoading(false));
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) setSelectedId(burnedOverlay?.overlay_id || null);
    }, [isOpen, burnedOverlay]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" eyebrow="EDITOR · OVERLAY" title="video overlay">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 flex items-center justify-center bg-black rounded-card border border-rule overflow-hidden relative aspect-[9/16] max-h-[600px]">
                    <video src={videoUrl} className="w-full h-full object-contain" muted playsInline loop autoPlay />
                </div>

                <div className="w-full md:w-80 flex flex-col">
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                        {loading && (
                            <div className="flex items-center gap-2 text-muted text-sm py-6 justify-center">
                                <Loader2 size={16} className="animate-spin" /> loading library...
                            </div>
                        )}

                        {!loading && overlaysList.length === 0 && (
                            <div className="p-3 border border-rule rounded-input text-xs text-muted space-y-1">
                                <p>No overlays in the library yet.</p>
                                <p>Drop video files into <code>assets/overlays/</code> and add an entry to <code>manifest.json</code> (see the README in that folder).</p>
                            </div>
                        )}

                        {!loading && overlaysList.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                                {overlaysList.map((o) => (
                                    <button
                                        key={o.id}
                                        onClick={() => setSelectedId(o.id)}
                                        className={`rounded-input border overflow-hidden text-left transition-colors
                                            ${selectedId === o.id ? 'border-[color:var(--color-accent)]' : 'border-rule2 hover:border-[color:var(--color-accent)]'}`}
                                    >
                                        {o.type === 'image' ? (
                                            <img
                                                src={getApiUrl(`/overlay-assets/${o.file}`)}
                                                className="w-full aspect-[9/16] object-contain bg-black"
                                                alt=""
                                            />
                                        ) : (
                                            <video
                                                src={getApiUrl(`/overlay-assets/${o.file}`)}
                                                className="w-full aspect-[9/16] object-cover bg-black"
                                                muted playsInline loop autoPlay
                                            />
                                        )}
                                        <div className="px-2 py-1.5 flex items-center gap-1">
                                            <Sparkles size={12} className="text-muted shrink-0" />
                                            <span className="text-[11px] text-ink2 truncate">{o.title}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {burnedOverlay && (
                            <div className="p-3 border border-rule rounded-input text-xs text-muted space-y-2 mt-4">
                                <p>This clip has an overlay burned in. Applying a new one replaces it.</p>
                                {onRemove && (
                                    <button
                                        onClick={onRemove}
                                        disabled={isProcessing}
                                        className="text-warn underline underline-offset-2 hover:opacity-80 transition-opacity"
                                    >
                                        remove overlay from clip
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 mt-5 shrink-0">
                        <button onClick={onClose} className="btn-ghost">
                            cancel
                        </button>
                        <button
                            onClick={() => onApply(selectedId)}
                            disabled={isProcessing || !selectedId}
                            className="btn-primary flex-1"
                        >
                            {isProcessing && <Loader2 size={16} className="animate-spin text-brassink" />}
                            {isProcessing ? 'applying...' : 'add overlay'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
