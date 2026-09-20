import React, { useState, useEffect } from 'react';
import { Film, Sparkles, Type, Music, Video, X } from 'lucide-react';
import { apiFetch } from '../lib/api';

const TRANSITION_TYPES = [
    { value: 'none', label: 'None' },
    { value: 'fade', label: 'Fade' },
    { value: 'dissolve', label: 'Dissolve' },
    { value: 'wipe', label: 'Wipe' },
];

const ANIMATIONS = [
    { value: 'none', label: 'None' },
    { value: 'fade-in', label: 'Fade In' },
    { value: 'scale-in', label: 'Scale In' },
    { value: 'slide-up', label: 'Slide Up' },
];

export default function EffectsPanel({
    jobId, clipIndex, segments,
    onEffectsChange, onClose,
}) {
    const [activeTab, setActiveTab] = useState('effects');
    const [luts, setLuts] = useState([]);
    const [selectedLut, setSelectedLut] = useState(null);
    const [transitions, setTransitions] = useState([]);
    const [textElements, setTextElements] = useState([]);
    const [newText, setNewText] = useState('');
    const [audioTracks, setAudioTracks] = useState([]);
    const [brollTracks, setBrollTracks] = useState([]);
    const [loadingLuts, setLoadingLuts] = useState(true);

    useEffect(() => {
        apiFetch(`/api/editor/luts`)
            .then(r => r.json())
            .then(d => setLuts(d.luts || []))
            .catch(() => {})
            .finally(() => setLoadingLuts(false));
    }, []);

    // Initialize transitions array if segments exist
    useEffect(() => {
        if (segments && segments.length > 1 && transitions.length === 0) {
            setTransitions(new Array(segments.length - 1).fill(null).map(() => ({ type: 'none', duration: 0.5 })));
        }
        // transitions.length is read as a guard, not a re-init trigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [segments]);

    const updateTransition = (idx, field, value) => {
        setTransitions(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
    };

    const addTextElement = () => {
        if (!newText.trim()) return;
        const el = {
            id: `text_${Date.now()}`,
            start: 0,
            end: segments?.[segments.length - 1]?.end || 10,
            content: newText.trim(),
            font: 'Arial',
            fontSize: 48,
            color: '#FFFFFF',
            bold: true,
            position: { x: 50, y: 15 },
            scale: 1,
            animation: 'fade-in',
        };
        const next = [...textElements, el];
        setTextElements(next);
        setNewText('');
        onEffectsChange({ text_elements: next, transitions, effect: selectedLut ? { type: 'lut', id: selectedLut } : null });
    };

    const removeTextElement = (id) => {
        const next = textElements.filter(t => t.id !== id);
        setTextElements(next);
        onEffectsChange({ text_elements: next, transitions, effect: selectedLut ? { type: 'lut', id: selectedLut } : null });
    };

    const updateTextElement = (id, patch) => {
        const next = textElements.map(t => t.id === id ? { ...t, ...patch } : t);
        setTextElements(next);
        onEffectsChange({ text_elements: next, transitions, effect: selectedLut ? { type: 'lut', id: selectedLut } : null });
    };

    const handleAudioUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const form = new FormData();
        form.append('file', file);
        try {
            const res = await apiFetch(
                `/api/clip/advanced/upload-audio?job_id=${jobId}&clip_index=${clipIndex}`,
                { method: 'POST', body: form }
            );
            const data = await res.json();
            if (data.file_path) {
                const track = {
                    id: data.id,
                    file_path: data.file_path,
                    start: 0,
                    end: segments?.[segments.length - 1]?.end || 10,
                    volume: 1.0,
                    fadeIn: 0,
                    fadeOut: 0,
                };
                const next = [...audioTracks, track];
                setAudioTracks(next);
                onEffectsChange({ audio_tracks: next, transitions, effect: selectedLut ? { type: 'lut', id: selectedLut } : null });
            }
        } catch (err) {
            console.error('Audio upload failed:', err);
        }
    };

    const handleBrollUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const form = new FormData();
        form.append('file', file);
        try {
            const res = await apiFetch(
                `/api/clip/advanced/upload-broll?job_id=${jobId}&clip_index=${clipIndex}`,
                { method: 'POST', body: form }
            );
            const data = await res.json();
            if (data.file_path) {
                const track = {
                    id: data.id,
                    file_path: data.file_path,
                    start: 0,
                    end: segments?.[segments.length - 1]?.end || 10,
                    position: { x: 0, y: 0 },
                    scale: 1,
                    opacity: 1,
                    z_index: 0,
                };
                const next = [...brollTracks, track];
                setBrollTracks(next);
                onEffectsChange({ broll_tracks: next, transitions, effect: selectedLut ? { type: 'lut', id: selectedLut } : null });
            }
        } catch (err) {
            console.error('B-roll upload failed:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-fade">
            <div className="bg-paper rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Sparkles size={18} className="text-brass" />
                        Advanced Editor
                    </h2>
                    <button onClick={onClose} className="btn-ghost p-1">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-rule px-4">
                    {[
                        { key: 'effects', icon: Sparkles, label: 'Effects' },
                        { key: 'subtitles', icon: Type, label: 'Subtitles' },
                        { key: 'audio', icon: Music, label: 'Audio' },
                        { key: 'broll', icon: Video, label: 'B-Roll' },
                        { key: 'text', icon: Type, label: 'Text' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                                activeTab === tab.key
                                    ? 'text-brass border-b-2 border-brass'
                                    : 'text-muted hover:text-ink'
                            }`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {activeTab === 'effects' && (
                        <>
                            {/* LUT Presets */}
                            <div>
                                <label className="eyebrow block mb-2">Color Grading / LUT</label>
                                {loadingLuts ? (
                                    <p className="text-muted text-sm">Loading LUTs...</p>
                                ) : luts.length === 0 ? (
                                    <p className="text-muted text-sm italic">No LUT presets found. Drop .cube files into <code className="text-xs bg-black/30 px-1 rounded">assets/luts/</code></p>
                                ) : (
                                    <div className="grid grid-cols-4 gap-2">
                                        {luts.map(lut => (
                                            <button
                                                key={lut.id}
                                                onClick={() => setSelectedLut(selectedLut === lut.id ? null : lut.id)}
                                                className={`px-3 py-2 rounded border text-sm transition-all ${
                                                    selectedLut === lut.id
                                                        ? 'border-brass bg-brass/10 text-brass'
                                                        : 'border-rule hover:border-accent'
                                                }`}
                                            >
                                                {lut.title}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Transitions */}
                            {segments && segments.length > 1 && (
                                <div>
                                    <label className="eyebrow block mb-2">
                                        Transitions ({segments.length - 1} cuts)
                                    </label>
                                    <div className="space-y-2">
                                        {transitions.map((tr, i) => (
                                            <div key={i} className="flex items-center gap-3 bg-black/20 rounded px-3 py-2">
                                                <span className="text-xs text-muted w-16">Cut {i + 1}</span>
                                                <select
                                                    value={tr.type}
                                                    onChange={e => updateTransition(i, 'type', e.target.value)}
                                                    className="input-field flex-1"
                                                >
                                                    {TRANSITION_TYPES.map(t => (
                                                        <option key={t.value} value={t.value}>{t.label}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="range"
                                                    min="0.1"
                                                    max="1.5"
                                                    step="0.1"
                                                    value={tr.duration}
                                                    onChange={e => updateTransition(i, 'duration', parseFloat(e.target.value))}
                                                    className="w-20 accent-brass"
                                                />
                                                <span className="text-xs text-muted w-8">{tr.duration}s</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'subtitles' && (
                        <p className="text-sm text-muted">
                            Subtitle styling is handled in the <strong>Captions</strong> panel.
                            Toggle <em>one-word-at-a-time</em> mode there for TikTok-style captions.
                        </p>
                    )}

                    {activeTab === 'audio' && (
                        <>
                            <div>
                                <label className="eyebrow block mb-2">Music / SFX</label>
                                <label className="btn-ghost w-full flex items-center gap-2 px-4 py-3 border-dashed border-2 cursor-pointer hover:border-brass">
                                    <Music size={16} className="text-brass" />
                                    <span>Upload audio file</span>
                                    <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                                </label>
                            </div>
                            {audioTracks.length > 0 && (
                                <div className="space-y-2">
                                    {audioTracks.map((track, i) => (
                                        <div key={track.id} className="flex items-center gap-3 bg-black/20 rounded px-3 py-2">
                                            <Music size={14} className="text-muted shrink-0" />
                                            <span className="text-sm flex-1 truncate">{track.file_path.split('/').pop()}</span>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={track.volume}
                                                onChange={e => {
                                                    const next = audioTracks.map((t, j) => j === i ? { ...t, volume: parseFloat(e.target.value) } : t);
                                                    setAudioTracks(next);
                                                    onEffectsChange({ audio_tracks: next, transitions, effect: selectedLut ? { type: 'lut', id: selectedLut } : null });
                                                }}
                                                className="w-20 accent-brass"
                                            />
                                            <span className="text-xs text-muted w-8">{Math.round(track.volume * 100)}%</span>
                                            <button onClick={() => {
                                                const next = audioTracks.filter((_, j) => j !== i);
                                                setAudioTracks(next);
                                                onEffectsChange({ audio_tracks: next, transitions, effect: selectedLut ? { type: 'lut', id: selectedLut } : null });
                                            }} className="text-muted hover:text-red-400">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'broll' && (
                        <>
                            <div>
                                <label className="eyebrow block mb-2">B-Roll / Overlays</label>
                                <label className="btn-ghost w-full flex items-center gap-2 px-4 py-3 border-dashed border-2 cursor-pointer hover:border-brass">
                                    <Video size={16} className="text-brass" />
                                    <span>Upload video</span>
                                    <input type="file" accept="video/*" className="hidden" onChange={handleBrollUpload} />
                                </label>
                            </div>
                            {brollTracks.length > 0 && (
                                <div className="space-y-2">
                                    {brollTracks.map((track, i) => (
                                        <div key={track.id} className="bg-black/20 rounded px-3 py-2 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Video size={14} className="text-muted shrink-0" />
                                                <span className="text-sm flex-1 truncate">{track.file_path.split('/').pop()}</span>
                                                <button onClick={() => {
                                                    const next = brollTracks.filter((_, j) => j !== i);
                                                    setBrollTracks(next);
                                                    onEffectsChange({ broll_tracks: next, transitions, effect: selectedLut ? { type: 'lut', id: selectedLut } : null });
                                                }} className="text-muted hover:text-red-400">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div>
                                                    <span className="text-muted">Opacity</span>
                                                    <input type="range" min="0" max="1" step="0.05" value={track.opacity}
                                                        onChange={e => {
                                                            const next = brollTracks.map((t, j) => j === i ? { ...t, opacity: parseFloat(e.target.value) } : t);
                                                            setBrollTracks(next);
                                                            onEffectsChange({ broll_tracks: next, transitions, effect: selectedLut ? { type: 'lut', id: selectedLut } : null });
                                                        }}
                                                        className="w-full accent-brass" />
                                                </div>
                                                <div>
                                                    <span className="text-muted">Scale</span>
                                                    <input type="range" min="0.1" max="3" step="0.1" value={track.scale}
                                                        onChange={e => {
                                                            const next = brollTracks.map((t, j) => j === i ? { ...t, scale: parseFloat(e.target.value) } : t);
                                                            setBrollTracks(next);
                                                            onEffectsChange({ broll_tracks: next, transitions, effect: selectedLut ? { type: 'lut', id: selectedLut } : null });
                                                        }}
                                                        className="w-full accent-brass" />
                                                </div>
                                                <div>
                                                    <span className="text-muted">Z-index</span>
                                                    <input type="number" min="0" max="10" value={track.z_index}
                                                        onChange={e => {
                                                            const next = brollTracks.map((t, j) => j === i ? { ...t, z_index: parseInt(e.target.value) } : t);
                                                            setBrollTracks(next);
                                                            onEffectsChange({ broll_tracks: next, transitions, effect: selectedLut ? { type: 'lut', id: selectedLut } : null });
                                                        }}
                                                        className="input-field w-full" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'text' && (
                        <>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newText}
                                    onChange={e => setNewText(e.target.value)}
                                    placeholder="Enter title or caption text..."
                                    className="input-field flex-1"
                                    onKeyDown={e => e.key === 'Enter' && addTextElement()}
                                />
                                <button onClick={addTextElement} className="btn-primary">Add</button>
                            </div>
                            {textElements.length > 0 && (
                                <div className="space-y-2">
                                    {textElements.map(el => (
                                        <div key={el.id} className="bg-black/20 rounded px-3 py-2 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Type size={14} className="text-muted shrink-0" />
                                                <span className="text-sm flex-1 truncate">{el.content}</span>
                                                <button onClick={() => removeTextElement(el.id)} className="text-muted hover:text-red-400">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div>
                                                    <span className="text-muted">Animation</span>
                                                    <select value={el.animation} onChange={e => updateTextElement(el.id, { animation: e.target.value })} className="input-field w-full mt-1">
                                                        {ANIMATIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <span className="text-muted">Color</span>
                                                    <input type="color" value={el.color} onChange={e => updateTextElement(el.id, { color: e.target.value })} className="w-full h-6 mt-1 rounded cursor-pointer" />
                                                </div>
                                                <div>
                                                    <span className="text-muted">Size</span>
                                                    <input type="range" min="24" max="96" value={el.fontSize} onChange={e => updateTextElement(el.id, { fontSize: parseInt(e.target.value) })} className="w-full accent-brass mt-1" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-rule">
                    <button onClick={onClose} className="btn-ghost">Cancel</button>
                    <button
                        onClick={() => onEffectsChange({ transitions, effect: selectedLut ? { type: 'lut', id: selectedLut } : null, text_elements: textElements, audio_tracks: audioTracks, broll_tracks: brollTracks })}
                        className="btn-primary"
                    >
                        Apply Effects
                    </button>
                </div>
            </div>
        </div>
    );
}
