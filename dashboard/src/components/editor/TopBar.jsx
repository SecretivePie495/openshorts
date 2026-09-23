import React from 'react';
import { Film, PanelLeft, PanelLeftClose, X } from 'lucide-react';

export default function TopBar({
    clipIndex, clipTitle, total, fmt,
    needsSourcePath, rerenderMinutes,
    showSource, sourceAvailable,
    onToggleSource, onConfirmClose, onClose, confirmClose, rendering,
}) {
    return (
        <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-rule flex items-start justify-between gap-3 bg-paper">
            <div className="min-w-0">
                <p className="eyebrow mb-0.5">EDITOR · CLIP {clipIndex + 1}</p>
                {clipTitle && (
                    <h2 className="font-display text-lg sm:text-xl text-ink truncate">{clipTitle}</h2>
                )}
                <p className="readout mt-1 truncate sm:hidden">
                    {fmt(total)} · {needsSourcePath ? 'FULL RE-FRAME' : 'FAST RECUT'}
                </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                {rerenderMinutes > 0 && (
                    <span className="readout hidden sm:inline">
                        ≈{Math.max(1, Math.ceil(total / 60))} MIN · PATH · {needsSourcePath ? 'RE-FRAME' : 'RECUT'}
                    </span>
                )}
                {sourceAvailable && (
                    <button
                        onClick={onToggleSource}
                        title={showSource ? 'hide source monitor' : 'show source monitor'}
                        aria-label={showSource ? 'hide source' : 'show source'}
                        className="btn-quiet text-xs py-1.5 px-2.5 flex items-center gap-1.5 lowercase"
                    >
                        {showSource ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
                        <span className="hidden sm:inline">{showSource ? 'hide source' : 'show source'}</span>
                    </button>
                )}
                {confirmClose ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-warn lowercase hidden sm:inline">discard changes?</span>
                        <button className="btn-danger text-xs py-1.5 px-3" onClick={onConfirmClose}>discard</button>
                        <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => onConfirmClose(false)}>keep editing</button>
                    </div>
                ) : (
                    <button
                        onClick={onClose}
                        className="p-2 rounded-input text-muted hover:text-ink hover:bg-paper3 transition-colors"
                        aria-label="close editor"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>
    );
}
