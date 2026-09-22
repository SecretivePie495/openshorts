import React from 'react';
import { Film, Mic, Type, Settings, Keyboard, Sparkles, PanelLeftClose, PanelLeft } from 'lucide-react';

// Compact vertical icon toolbar. Each button shows a tooltip on hover/focus.
const TOOLS = [
    { id: 'source', icon: Film, label: 'Source monitor', action: 'toggleSource' },
    { id: 'transcript', icon: Mic, label: 'Transcript', action: 'showTranscript' },
    { id: 'framing', icon: Settings, label: 'Framing', action: 'showInspector' },
    { id: 'captions', icon: Type, label: 'Captions', action: 'showInspector' },
    { id: 'keyboard', icon: Keyboard, label: 'Shortcuts', action: 'showKeyboard' },
    { id: 'effects', icon: Sparkles, label: 'Effects', action: 'openEffects' },
];

export default function LeftNav({
    activeTab,
    onAction,
    showSource,
    setShowSource,
}) {
    const handleTool = (tool) => {
        if (tool.action === 'toggleSource') {
            setShowSource(v => !v);
        } else {
            onAction?.(tool.action, tool.id);
        }
    };

    return (
        <div className="shrink-0 w-11 flex flex-col items-center gap-0.5 py-3 bg-paper border-r border-rule select-none">
            {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const active = activeTab === tool.id;
                return (
                    <button
                        key={tool.id}
                        onClick={() => handleTool(tool)}
                        title={tool.label}
                        aria-label={tool.label}
                        className={`w-8 h-8 rounded-input flex items-center justify-center transition-colors ${
                            active
                                ? 'bg-brass/20 text-brassink'
                                : 'text-muted hover:text-ink hover:bg-paper3'
                        }`}
                    >
                        <Icon size={16} />
                    </button>
                );
            })}

            <div className="flex-1" />

            <button
                onClick={() => setShowSource(v => !v)}
                title={showSource ? 'hide source' : 'show source'}
                aria-label={showSource ? 'hide source' : 'show source'}
                className="w-8 h-8 rounded-input flex items-center justify-center text-muted hover:text-ink hover:bg-paper3 transition-colors"
            >
                {showSource ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
            </button>
        </div>
    );
}
