import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import RemotionPreview from './RemotionPreview';
import Modal from './ui/Modal';
import SegmentedControl from './ui/SegmentedControl';

const FONT_OPTIONS = [
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Impact', label: 'Impact' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Courier New', label: 'Courier New' },
    // Caption display fonts pulled from a dafontfree.net pack (see
    // fonts/subtitle-packs/README.md) — most are marked personal-use/demo
    // by their authors, not cleared for a paid product's output.
    { value: 'Akira Expanded', label: 'Akira Expanded' },
    { value: 'Burbank Big Condensed', label: 'Burbank Big Condensed' },
    { value: 'Dimbo Italic', label: 'Dimbo Italic' },
    { value: 'Dimbo Regular', label: 'Dimbo Regular' },
    { value: 'Gilliany', label: 'Gilliany' },
    { value: 'QUARTZO', label: 'QUARTZO' },
    { value: 'QUARTZO demo PERSONAL USE ONLY', label: 'QUARTZO demo PERSONAL USE ONLY' },
    { value: 'QUARTZO demo PERSONAL USE ONLY 2', label: 'QUARTZO demo PERSONAL USE ONLY 2' },
    { value: 'Questrian', label: 'Questrian' },
    { value: 'Rainbow', label: 'Rainbow' },
    { value: 'Red Rocket Academy', label: 'Red Rocket Academy' },
    { value: 'Regensburg Grunged RegensburgGrunged', label: 'Regensburg Grunged RegensburgGrunged' },
    { value: 'Regensburg Grunged RegensburgGrunged Italic', label: 'Regensburg Grunged RegensburgGrunged Italic' },
    { value: 'Regensburg Italic', label: 'Regensburg Italic' },
    { value: 'Regensburg Regensburg', label: 'Regensburg Regensburg' },
    { value: 'Restaurant Menu', label: 'Restaurant Menu' },
    { value: 'Restaurant Menu Book', label: 'Restaurant Menu Book' },
    { value: 'Restaurant Menu Book College', label: 'Restaurant Menu Book College' },
    { value: 'Restaurant Menu Hollow', label: 'Restaurant Menu Hollow' },
    { value: 'Retroica', label: 'Retroica' },
    { value: 'REVOLUTION', label: 'REVOLUTION' },
    { value: 'Riffic Free', label: 'Riffic Free' },
    { value: 'RissaTypeface', label: 'RissaTypeface' },
    { value: 'Road Rage', label: 'Road Rage' },
    { value: 'ROBO', label: 'ROBO' },
    { value: 'Roboto Condensed RobotoCondensed Bold', label: 'Roboto Condensed RobotoCondensed Bold' },
    { value: 'Roboto Condensed RobotoCondensed BoldItalic', label: 'Roboto Condensed RobotoCondensed BoldItalic' },
    { value: 'Roboto Condensed RobotoCondensed Italic', label: 'Roboto Condensed RobotoCondensed Italic' },
    { value: 'Russo One', label: 'Russo One' },
    { value: 'Saltino Saltino', label: 'Saltino Saltino' },
    { value: 'Saltino Saltino 2', label: 'Saltino Saltino 2' },
    { value: 'SanelmaW00-Regular', label: 'SanelmaW00-Regular' },
    { value: 'Screengem', label: 'Screengem' },
    { value: 'SeriesOrbit', label: 'SeriesOrbit' },
    { value: 'SF Collegiate Solid', label: 'SF Collegiate Solid' },
    { value: 'SF Viper Squadron', label: 'SF Viper Squadron' },
    { value: 'Sheeping Dogs', label: 'Sheeping Dogs' },
    { value: 'Shlop', label: 'Shlop' },
    { value: 'Short Xurkit', label: 'Short Xurkit' },
    { value: 'Short Xurkit Tilt', label: 'Short Xurkit Tilt' },
    { value: 'Shutter Braille Free Version', label: 'Shutter Braille Free Version' },
    { value: 'Signatra DEMO Signatra', label: 'Signatra DEMO Signatra' },
    { value: 'Signatra DEMO Signatra 2', label: 'Signatra DEMO Signatra 2' },
    { value: 'SIMPLCITY PERSONAL USE', label: 'SIMPLCITY PERSONAL USE' },
    { value: 'SIMPLICITY SHADOW PERSONAL USE', label: 'SIMPLICITY SHADOW PERSONAL USE' },
    { value: 'SkaterDudes', label: 'SkaterDudes' },
    { value: 'Sketch 3D', label: 'Sketch 3D' },
    { value: 'Slant', label: 'Slant' },
    { value: 'Slimlines', label: 'Slimlines' },
    { value: 'Snickles', label: 'Snickles' },
    { value: 'Sontoloyo', label: 'Sontoloyo' },
    { value: 'Soup of Justice', label: 'Soup of Justice' },
    { value: 'Soviet Program SovietProgram', label: 'Soviet Program SovietProgram' },
    { value: 'Soviet Program SovietProgram Bold', label: 'Soviet Program SovietProgram Bold' },
    { value: 'Soviet Program SovietProgram BoldItalic', label: 'Soviet Program SovietProgram BoldItalic' },
    { value: 'Soviet Program SovietProgram Italic', label: 'Soviet Program SovietProgram Italic' },
    { value: 'Space Age', label: 'Space Age' },
    { value: 'SPIDER MONKEY', label: 'SPIDER MONKEY' },
    { value: 'Stalinist One', label: 'Stalinist One' },
    { value: 'Star Jedi', label: 'Star Jedi' },
    { value: 'Starlight Personal', label: 'Starlight Personal' },
    { value: 'Strenuous', label: 'Strenuous' },
    { value: 'Sugarpunch DEMO', label: 'Sugarpunch DEMO' },
    { value: 'SummerLove', label: 'SummerLove' },
    { value: 'Super glue', label: 'Super glue' },
    { value: 'Super Mario 256', label: 'Super Mario 256' },
    { value: 'Super Mario World', label: 'Super Mario World' },
    { value: 'Supersonic Rocketship', label: 'Supersonic Rocketship' },
    { value: 'Surfing Capital', label: 'Surfing Capital' },
    { value: 'Technique BRK', label: 'Technique BRK' },
    { value: 'Technique OL BRK', label: 'Technique OL BRK' },
    { value: 'Territorial', label: 'Territorial' },
    { value: 'The Bold Font', label: 'The Bold Font' },
    { value: 'The Breakdown', label: 'The Breakdown' },
    { value: 'The Godfather', label: 'The Godfather' },
    { value: 'The Juke Box', label: 'The Juke Box' },
    { value: 'Thinking Of Betty', label: 'Thinking Of Betty' },
    { value: 'Thunder Lord', label: 'Thunder Lord' },
    { value: 'Thunder Titan', label: 'Thunder Titan' },
    { value: 'Thunderstrike', label: 'Thunderstrike' },
    { value: 'Timeline', label: 'Timeline' },
    { value: 'Times New Yorker', label: 'Times New Yorker' },
    { value: 'Tough Love', label: 'Tough Love' },
    { value: 'Toxico', label: 'Toxico' },
    { value: 'Transformers', label: 'Transformers' },
    { value: 'Troublemarker DEMO', label: 'Troublemarker DEMO' },
    { value: 'True Lies', label: 'True Lies' },
    { value: 'TYPOGRAPH PRO', label: 'TYPOGRAPH PRO' },
    { value: 'TypoGraphica', label: 'TypoGraphica' },
    { value: 'Umbrage', label: 'Umbrage' },
    { value: 'Uni Sans Heavy', label: 'Uni Sans Heavy' },
    { value: 'Uni Sans Heavy Italic', label: 'Uni Sans Heavy Italic' },
    { value: 'Uni Sans heavy italic caps', label: 'Uni Sans heavy italic caps' },
    { value: 'UnitaW01-ExtraBold', label: 'UnitaW01-ExtraBold' },
    { value: 'University', label: 'University' },
    { value: 'Unrealised', label: 'Unrealised' },
    { value: 'Varsity Regular', label: 'Varsity Regular' },
    { value: 'Vermin Vibes', label: 'Vermin Vibes' },
    { value: 'Vermin Vibes V', label: 'Vermin Vibes V' },
    { value: 'Viafont', label: 'Viafont' },
    { value: 'Videopac', label: 'Videopac' },
    { value: 'Walrus', label: 'Walrus' },
    { value: 'Whiskey Bravo Victor', label: 'Whiskey Bravo Victor' },
    { value: 'Whiskey Bravo Victor Bold', label: 'Whiskey Bravo Victor Bold' },
    { value: 'Whiskey Bravo Victor Condensed', label: 'Whiskey Bravo Victor Condensed' },
    { value: 'Whiskey Bravo Victor Expanded', label: 'Whiskey Bravo Victor Expanded' },
    { value: 'Whiskey Bravo Victor Halftone', label: 'Whiskey Bravo Victor Halftone' },
    { value: 'Whiskey Bravo Victor Italic', label: 'Whiskey Bravo Victor Italic' },
    { value: 'Whiskey Bravo Victor Laser', label: 'Whiskey Bravo Victor Laser' },
    { value: 'Whiskey Bravo Victor Laser Pro', label: 'Whiskey Bravo Victor Laser Pro' },
    { value: 'Whiskey Bravo Victor Leftalic', label: 'Whiskey Bravo Victor Leftalic' },
    { value: 'Whiskey Bravo Victor Outline', label: 'Whiskey Bravo Victor Outline' },
    { value: 'WhoopAss', label: 'WhoopAss' },
    { value: 'Wide awake Black', label: 'Wide awake Black' },
    { value: 'woodcutter carnage', label: 'woodcutter carnage' },
    { value: 'Xenos', label: 'Xenos' },
    { value: 'Xheighter Black BlackOblique', label: 'Xheighter Black BlackOblique' },
    { value: 'Xheighter Black Xheighter Black', label: 'Xheighter Black Xheighter Black' },
    { value: 'Xheighter Light LightOblique', label: 'Xheighter Light LightOblique' },
    { value: 'Xheighter Light Xheighter Light', label: 'Xheighter Light Xheighter Light' },
    { value: 'Zephyrean BRK', label: 'Zephyrean BRK' },
    { value: 'Zilap Black Storm', label: 'Zilap Black Storm' },
    { value: 'Zilap Monograma', label: 'Zilap Monograma' },
];

const COLOR_PRESETS = [
    { color: '#FFFFFF', label: 'White' },
    { color: '#FFFF00', label: 'Yellow' },
    { color: '#00FFFF', label: 'Cyan' },
    { color: '#00FF00', label: 'Green' },
    { color: '#FF0000', label: 'Red' },
    { color: '#FF69B4', label: 'Pink' },
];

const HIGHLIGHT_PRESETS = [
    { color: '#FFDD00', label: 'Gold' },
    { color: '#FF4444', label: 'Red' },
    { color: '#00FF88', label: 'Green' },
    { color: '#00BBFF', label: 'Blue' },
    { color: '#FF69B4', label: 'Pink' },
];

const ANIMATION_OPTIONS = [
    { value: 'pop', label: 'Pop' },
    { value: 'word-highlight', label: 'Glow' },
    { value: 'karaoke', label: 'Karaoke' },
    { value: 'scale-in', label: 'Scale In' },
    { value: 'none', label: 'None' },
];

const POSITION_OPTIONS = [
    { value: 'top', label: 'top' },
    { value: 'middle', label: 'middle' },
    { value: 'bottom', label: 'bottom' },
];

// Fallback anchor for the free-drag handle before the user has dragged at all.
const PRESET_FRACTIONS = { top: { x: 0.5, y: 0.15 }, middle: { x: 0.5, y: 0.45 }, bottom: { x: 0.5, y: 0.85 } };

// Ready-made caption looks burned server-side as karaoke ASS (word highlight):
// dimmed base text + strong active word, optional glow/pop/box effect.
const CAPTION_PRESETS = [
    { id: 'tiktok',  label: 'TikTok',     style: 'karaoke', effect: 'none', highlightColor: '#FE2C55', baseOpacity: 0.75, uppercase: false, fontName: 'Verdana', borderWidth: 2 },
    { id: 'reels',   label: 'Reels',      style: 'karaoke', effect: 'none', highlightColor: '#E1306C', baseOpacity: 0.7,  uppercase: false, fontName: 'Verdana', borderWidth: 2 },
    { id: 'shorts',  label: 'Shorts Pop', style: 'karaoke', effect: 'pop',  highlightColor: '#FF0000', baseOpacity: 0.7,  uppercase: false, fontName: 'Verdana', borderWidth: 2 },
    { id: 'gold',    label: 'Gold Glow',  style: 'karaoke', effect: 'glow', highlightColor: '#FFD700', baseOpacity: 0.6,  uppercase: false, fontName: 'Verdana', borderWidth: 2 },
    { id: 'neon',    label: 'Neon',       style: 'karaoke', effect: 'glow', highlightColor: '#00FF88', baseOpacity: 0.55, uppercase: false, fontName: 'Verdana', borderWidth: 2 },
    { id: 'cyber',   label: 'Cyber',      style: 'karaoke', effect: 'glow', highlightColor: '#00FFFF', baseOpacity: 0.5,  uppercase: false, fontName: 'Verdana', borderWidth: 2 },
    { id: 'karaoke', label: 'Karaoke',    style: 'karaoke', effect: 'none', highlightColor: '#FF6B6B', baseOpacity: 0.6,  uppercase: false, fontName: 'Verdana', borderWidth: 2 },
    { id: 'minimal', label: 'Minimal',    style: 'karaoke', effect: 'none', highlightColor: '#FFFFFF', baseOpacity: 0.65, uppercase: false, fontName: 'Verdana', borderWidth: 1 },
    { id: 'beast',   label: 'Beast',      style: 'karaoke', effect: 'pop',  highlightColor: '#FFD700', baseOpacity: 1.0,  uppercase: true,  fontName: 'Impact',  borderWidth: 3 },
    { id: 'boxed',   label: 'Boxed',      style: 'karaoke', effect: 'box',  highlightColor: '#7C3AED', baseOpacity: 0.85, uppercase: false, fontName: 'Verdana', borderWidth: 2 },
    { id: 'classic', label: 'Classic',    style: 'classic', effect: 'none', highlightColor: '#FFD700', baseOpacity: 1.0,  uppercase: false, fontName: 'Verdana', borderWidth: 2 },
];

const swatchClass = (selected) =>
    `w-6 h-6 rounded-full transition-all ${selected
        ? 'ring-2 ring-[color:var(--color-accent)] ring-offset-2 ring-offset-[color:var(--color-paper-2)]'
        : 'ring-1 ring-[color:var(--color-rule-2)] hover:ring-[color:var(--color-accent)]'}`;

export default function SubtitleModal({ isOpen, onClose, onGenerate, onApplyAll, onRemove, isProcessing, videoUrl, jobId, clipIndex, existingHook, bulkCount = 0, bulkProgress }) {
    const [position, setPosition] = useState('bottom');
    const [fontSize, setFontSize] = useState(24);
    // Matches subtitles.py's SAFE_MARGIN_V — distance from the top/bottom
    // edge in ASS PlayResY=288 units; "middle" ignores this server-side too.
    const [marginV, setMarginV] = useState(43);
    const [fontName, setFontName] = useState('Verdana');
    const [fontColor, setFontColor] = useState('#FFFFFF');
    const [highlightColor, setHighlightColor] = useState('#FFDD00');
    const [borderColor, setBorderColor] = useState('#000000');
    const [borderWidth, setBorderWidth] = useState(2);
    const [bgColor, setBgColor] = useState('#000000');
    const [bgOpacity, setBgOpacity] = useState(0.0);
    const [animation, setAnimation] = useState('pop');
    const [showTextEditor, setShowTextEditor] = useState(false);

    // Karaoke (server-side ASS burn) state
    const [style, setStyle] = useState('classic'); // classic | karaoke
    const [effect, setEffect] = useState('none'); // none | glow | pop | box
    const [baseOpacity, setBaseOpacity] = useState(1.0);
    const [uppercase, setUppercase] = useState(false);
    const [activePreset, setActivePreset] = useState(null);

    // Drag-to-move (anywhere, both axes) and drag-to-resize (fontSize) on the
    // preview — same free-drag pattern as HookModal's xPct/yPct. Picking a
    // top/middle/bottom preset clears the free position; dragging the handle
    // sets it and overrides the preset (see subtitleConfig below).
    // Preview/in-browser-render only: the ASS burn always centers the line
    // horizontally (MarginL/MarginR fixed server-side in subtitles.py), so a
    // clip that falls back to that server path renders centered with only
    // the vertical component honored (derived from freePos.y at generate
    // time — see the apply button handler).
    const previewRef = useRef(null);
    const dragRef = useRef(null); // { kind: 'move' | 'resize', startY, startFontSize }
    const [freePos, setFreePos] = useState(null); // { x, y } in 0-1, overrides the position preset when set

    const handlePos = freePos || PRESET_FRACTIONS[position] || PRESET_FRACTIONS.bottom;

    const fractionFromPointer = (clientX, clientY) => {
        const rect = previewRef.current.getBoundingClientRect();
        return {
            x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
            y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
        };
    };

    const startMoveDrag = (e) => {
        e.preventDefault();
        dragRef.current = { kind: 'move' };
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    const startResizeDrag = (e) => {
        e.preventDefault();
        dragRef.current = { kind: 'resize', startY: e.clientY, startFontSize: fontSize };
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    const onHandleDragMove = (e) => {
        const d = dragRef.current;
        if (!d || !previewRef.current) return;
        if (d.kind === 'move') {
            setFreePos(fractionFromPointer(e.clientX, e.clientY));
        } else if (d.kind === 'resize') {
            const deltaPx = e.clientY - d.startY;
            setFontSize(Math.round(Math.min(48, Math.max(12, d.startFontSize + deltaPx / 6))));
        }
    };
    const onHandleDragEnd = () => {
        dragRef.current = null;
    };

    const applyPreset = (p) => {
        setActivePreset(p.id);
        setStyle(p.style);
        setEffect(p.effect);
        setHighlightColor(p.highlightColor);
        setBaseOpacity(p.baseOpacity);
        setUppercase(p.uppercase);
        setFontName(p.fontName);
        setBorderWidth(p.borderWidth);
        setFontColor('#FFFFFF');
        setBgOpacity(0);
        // Keep the Remotion preview roughly in sync with the burned look
        setAnimation(p.style === 'karaoke' ? (p.effect === 'pop' ? 'pop' : p.effect === 'glow' ? 'word-highlight' : 'karaoke') : 'none');
    };

    // Remotion preview state
    const [captions, setCaptions] = useState([]);
    const [originalCaptions, setOriginalCaptions] = useState([]);
    const [editableText, setEditableText] = useState('');
    const [durationSec, setDurationSec] = useState(30);
    const [captionsLoading, setCaptionsLoading] = useState(false);
    const [useRemotionPreview, setUseRemotionPreview] = useState(false);

    // Fetch word-level captions when modal opens
    useEffect(() => {
        if (!isOpen || !jobId || clipIndex === undefined) return;

        setCaptionsLoading(true);
        apiFetch(`/api/clip/${jobId}/${clipIndex}/transcript`)
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                if (data && data.captions && data.captions.length > 0) {
                    setCaptions(data.captions);
                    setOriginalCaptions(data.captions);
                    setEditableText(data.captions.map(c => c.text).join(' '));
                    setDurationSec(data.durationSec || 30);
                    setUseRemotionPreview(true);
                } else {
                    setUseRemotionPreview(false);
                }
            })
            .catch(() => setUseRemotionPreview(false))
            .finally(() => setCaptionsLoading(false));
    }, [isOpen, jobId, clipIndex]);

    // When user edits text, redistribute words across original timestamps
    const handleTextEdit = (newText) => {
        setEditableText(newText);
        const newWords = newText.split(/\s+/).filter(w => w.length > 0);
        if (newWords.length === 0 || originalCaptions.length === 0) {
            setCaptions([]);
            return;
        }

        // Distribute new words across the time span of original captions
        const totalDurationMs = originalCaptions[originalCaptions.length - 1].endMs - originalCaptions[0].startMs;
        const startMs = originalCaptions[0].startMs;
        const wordDurationMs = totalDurationMs / newWords.length;

        const newCaptions = newWords.map((word, i) => ({
            text: word,
            startMs: Math.round(startMs + i * wordDurationMs),
            endMs: Math.round(startMs + (i + 1) * wordDurationMs),
        }));
        setCaptions(newCaptions);
    };

    if (!isOpen) return null;

    // Build subtitle config for Remotion
    const subtitleConfig = {
        captions,
        position,
        style: {
            fontFamily: fontName,
            fontSize: fontSize * 2.2, // Scale up for 1080p (modal fontSize is for small preview)
            fontColor,
            highlightColor,
            borderColor,
            borderWidth: borderWidth * 1.5,
            bgColor,
            bgOpacity,
            animation,
            // Karaoke look reflected live in the playable preview.
            baseOpacity: style === 'karaoke' ? baseOpacity : 1,
            uppercase: style === 'karaoke' ? uppercase : false,
            marginV,
        },
        ...(freePos ? { xPct: freePos.x, yPct: freePos.y } : {}),
    };

    // Fallback: static CSS preview (same as original)
    const bw = Math.max(borderWidth, 0);
    const bc = borderColor;
    const outlineShadow = bw > 0 ? [
        `-${bw}px -${bw}px 0 ${bc}`, `${bw}px -${bw}px 0 ${bc}`,
        `-${bw}px ${bw}px 0 ${bc}`, `${bw}px ${bw}px 0 ${bc}`,
        `0 -${bw}px 0 ${bc}`, `0 ${bw}px 0 ${bc}`,
        `-${bw}px 0 0 ${bc}`, `${bw}px 0 0 ${bc}`,
    ].join(', ') : 'none';

    const fallbackPreviewStyle = {
        fontFamily: fontName,
        color: fontColor,
        fontSize: '20px',
        fontWeight: 'bold',
        maxWidth: '85%',
        padding: '6px 12px',
        borderRadius: '4px',
        textAlign: 'center',
        lineHeight: '1.3',
        ...(bgOpacity > 0
            ? {
                backgroundColor: `${bgColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`,
                textShadow: 'none',
            }
            : { textShadow: outlineShadow }
        ),
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" eyebrow="EDITOR · SUBTITLES" title="subtitles">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Left: Preview */}
                <div ref={previewRef} className="flex-1 flex flex-col items-center justify-center bg-black rounded-card border border-rule overflow-hidden relative aspect-[9/16] max-h-[600px]">
                    {captionsLoading ? (
                        <div className="flex items-center gap-2 text-muted">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-sm lowercase">Loading preview...</span>
                        </div>
                    ) : useRemotionPreview ? (
                        <RemotionPreview
                            videoUrl={videoUrl}
                            durationInSeconds={durationSec}
                            subtitles={subtitleConfig}
                            hook={existingHook || null}
                        />
                    ) : (
                        <>
                            <video src={videoUrl} className="w-full h-full object-contain opacity-50" muted playsInline />
                            <div className={`absolute w-full px-8 text-center transition-all duration-300 pointer-events-none flex flex-col items-center justify-center
                                ${position === 'top' ? 'top-20' : ''}
                                ${position === 'middle' ? 'top-0 bottom-0' : ''}
                                ${position === 'bottom' ? 'bottom-20' : ''}
                            `}>
                                <span style={fallbackPreviewStyle}>
                                    This is how your subtitles<br/>will appear on the video
                                </span>
                            </div>
                        </>
                    )}
                    {/* Drag-to-move / drag-to-resize handles, mirroring the hook overlay */}
                    {!captionsLoading && (
                        <div
                            onPointerDown={startMoveDrag}
                            onPointerMove={onHandleDragMove}
                            onPointerUp={onHandleDragEnd}
                            style={{
                                position: 'absolute',
                                left: `${handlePos.x * 100}%`,
                                top: `${handlePos.y * 100}%`,
                                transform: freePos ? 'translate(-50%, -50%)'
                                    : position === 'bottom' ? 'translate(-50%, 6px)' : 'translate(-50%, -18px)',
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
                            ⠿ drag to move
                        </div>
                    )}
                    {!captionsLoading && (
                        <div
                            onPointerDown={startResizeDrag}
                            onPointerMove={onHandleDragMove}
                            onPointerUp={onHandleDragEnd}
                            style={{
                                position: 'absolute',
                                left: `${handlePos.x * 100}%`,
                                top: `${handlePos.y * 100}%`,
                                transform: freePos ? 'translate(24px, -50%)'
                                    : position === 'bottom' ? 'translate(56px, 6px)' : 'translate(56px, -18px)',
                                cursor: 'ns-resize',
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
                            title="Drag up/down to resize"
                        >
                            ⤢ size
                        </div>
                    )}
                </div>

                {/* Right: Controls */}
                <div className="w-full md:w-80 flex flex-col">
                    <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                        {/* Caption presets (server-side karaoke burn) */}
                        <div>
                            <p className="eyebrow mb-2">Preset</p>
                            <div className="grid grid-cols-3 gap-1.5">
                                {CAPTION_PRESETS.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => applyPreset(p)}
                                        className={`px-2 py-1.5 rounded-input border text-xs transition-colors flex items-center gap-1.5 justify-center
                                            ${activePreset === p.id
                                                ? 'border-[color:var(--color-accent)] text-ink'
                                                : 'border-rule2 text-muted hover:border-[color:var(--color-accent)]'}`}
                                        title={p.label}
                                    >
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.highlightColor }} />
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            {style === 'karaoke' && (
                                <div className="mt-3 space-y-3 animate-fade">
                                    <div className="flex items-center justify-between">
                                        <span className="readout">UPPERCASE</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} className="sr-only peer" />
                                            <div className="w-8 h-4 rounded-full bg-paper3 peer-checked:bg-brass transition-colors after:content-[''] after:absolute after:top-0 after:left-0 after:h-4 after:w-4 after:rounded-full after:bg-ink after:transition-all peer-checked:after:translate-x-full"></div>
                                        </label>
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="readout">Dim inactive words</span>
                                            <span className="readout">{Math.round(baseOpacity * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="30"
                                            max="100"
                                            value={Math.round(baseOpacity * 100)}
                                            onChange={(e) => setBaseOpacity(parseInt(e.target.value) / 100)}
                                            className="w-full accent-[var(--color-accent)]"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Position Selector */}
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
                                        {' '}If this clip needs the server-side karaoke burn, only the vertical position carries over — that path always centers the line horizontally.
                                      </>
                                    : 'Or drag the handle on the preview to place it anywhere.'}
                            </p>
                            {!freePos && position !== 'middle' && (
                                <div className="mt-3">
                                    <div className="flex justify-between mb-1">
                                        <span className="readout">Fine-tune position</span>
                                        <span className="readout">{marginV}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="160"
                                        value={marginV}
                                        onChange={(e) => setMarginV(parseInt(e.target.value))}
                                        className="w-full accent-[var(--color-accent)]"
                                    />
                                    <div className="flex justify-between">
                                        <span className="readout">Edge</span>
                                        <span className="readout">Center</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Font Size */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <p className="eyebrow">Size</p>
                                <span className="readout">{fontSize}</span>
                            </div>
                            <input
                                type="range"
                                min="12"
                                max="48"
                                value={fontSize}
                                onChange={(e) => setFontSize(parseInt(e.target.value))}
                                className="w-full accent-[var(--color-accent)]"
                            />
                            <div className="flex justify-between">
                                <span className="readout">Small</span>
                                <span className="readout">Large</span>
                            </div>
                        </div>

                        {/* Animation Style (new) */}
                        <div>
                            <p className="eyebrow mb-2">Animation</p>
                            <SegmentedControl
                                options={ANIMATION_OPTIONS}
                                value={animation}
                                onChange={setAnimation}
                                columns={2}
                                size="sm"
                            />
                        </div>

                        {/* Editable Transcript (collapsible) */}
                        {useRemotionPreview && (
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowTextEditor(!showTextEditor)}
                                    className="w-full flex items-center justify-between mb-2"
                                >
                                    <span className="eyebrow">Edit text ({captions.length} words)</span>
                                    <span className={`text-muted transition-transform ${showTextEditor ? 'rotate-180' : ''}`}>▾</span>
                                </button>
                                {showTextEditor && (
                                    <textarea
                                        value={editableText}
                                        onChange={(e) => handleTextEdit(e.target.value)}
                                        rows={5}
                                        className="input-field resize-none leading-relaxed animate-fade"
                                        placeholder="Edit subtitle text..."
                                    />
                                )}
                            </div>
                        )}

                        {/* Font Family */}
                        <div>
                            <p className="eyebrow mb-2">Font</p>
                            <select
                                value={fontName}
                                onChange={(e) => setFontName(e.target.value)}
                                className="input-field"
                            >
                                {FONT_OPTIONS.map((f) => (
                                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Text Color */}
                        <div>
                            <p className="eyebrow mb-2">Text color</p>
                            <div className="flex flex-wrap items-center gap-2.5">
                                {COLOR_PRESETS.map((c) => (
                                    <button
                                        key={c.color}
                                        onClick={() => setFontColor(c.color)}
                                        className={swatchClass(fontColor === c.color)}
                                        style={{ backgroundColor: c.color }}
                                        title={c.label}
                                    />
                                ))}
                                <label className="w-6 h-6 rounded-full border border-dashed border-rule2 cursor-pointer flex items-center justify-center hover:border-brass transition-colors overflow-hidden relative" title="Custom color">
                                    <span className="text-xs text-muted leading-none">+</span>
                                    <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </label>
                            </div>
                        </div>

                        {/* Highlight Color (new) */}
                        <div>
                            <p className="eyebrow mb-2">Highlight</p>
                            <div className="flex flex-wrap items-center gap-2.5">
                                {HIGHLIGHT_PRESETS.map((c) => (
                                    <button
                                        key={c.color}
                                        onClick={() => setHighlightColor(c.color)}
                                        className={swatchClass(highlightColor === c.color)}
                                        style={{ backgroundColor: c.color }}
                                        title={c.label}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Border / Outline */}
                        <div>
                            <p className="eyebrow mb-2">Border</p>
                            <div className="flex items-center gap-3">
                                <label className="relative w-8 h-8 rounded-input border border-rule2 cursor-pointer overflow-hidden shrink-0" title="Border color">
                                    <div className="w-full h-full" style={{ backgroundColor: borderColor }} />
                                    <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </label>
                                <div className="flex-1">
                                    <input
                                        type="range"
                                        min="0"
                                        max="5"
                                        value={borderWidth}
                                        onChange={(e) => setBorderWidth(parseInt(e.target.value))}
                                        className="w-full accent-[var(--color-accent)]"
                                    />
                                    <div className="flex justify-between">
                                        <span className="readout">None</span>
                                        <span className="readout">Thick</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Background Box */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="eyebrow">Background</p>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={bgOpacity > 0} onChange={(e) => setBgOpacity(e.target.checked ? 0.5 : 0)} className="sr-only peer" />
                                    <div className="w-8 h-4 rounded-full bg-paper3 peer-checked:bg-brass transition-colors after:content-[''] after:absolute after:top-0 after:left-0 after:h-4 after:w-4 after:rounded-full after:bg-ink after:transition-all peer-checked:after:translate-x-full"></div>
                                </label>
                            </div>
                            {bgOpacity > 0 && (
                                <div className="space-y-3 animate-fade">
                                    <div className="flex items-center gap-3">
                                        <label className="relative w-8 h-8 rounded-input border border-rule2 cursor-pointer overflow-hidden shrink-0" title="Background color">
                                            <div className="w-full h-full" style={{ backgroundColor: bgColor }} />
                                            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        </label>
                                        <div className="flex-1">
                                            <input
                                                type="range"
                                                min="10"
                                                max="100"
                                                value={Math.round(bgOpacity * 100)}
                                                onChange={(e) => setBgOpacity(parseInt(e.target.value) / 100)}
                                                className="w-full accent-[var(--color-accent)]"
                                            />
                                            <div className="flex justify-between">
                                                <span className="readout">Transparent</span>
                                                <span className="readout">{Math.round(bgOpacity * 100)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-5 shrink-0 space-y-2">
                        {(() => {
                            // Text edits must survive the server render path too
                            // (issue #69): send the edited words whenever the text
                            // differs from what the transcript produced.
                            const textEdited = originalCaptions.length > 0
                                && editableText.trim() !== originalCaptions.map((c) => c.text).join(' ').trim();
                            // The server ASS burn has no xPct/yPct — approximate a custom
                            // drag with the nearest top/middle/bottom + marginV so it isn't
                            // silently dropped for clips that fall back to that path.
                            const fallbackPosition = !freePos ? position
                                : freePos.y < 0.33 ? 'top'
                                : freePos.y > 0.67 ? 'bottom'
                                : 'middle';
                            const fallbackMarginV = !freePos ? marginV
                                : fallbackPosition === 'top' ? Math.round(freePos.y * 288)
                                : fallbackPosition === 'bottom' ? Math.round((1 - freePos.y) * 288)
                                : marginV;
                            const styleOptions = {
                                position: fallbackPosition, fontSize, marginV: fallbackMarginV, fontName, fontColor, borderColor, borderWidth, bgColor, bgOpacity,
                                // Karaoke burn (server-side ASS render)
                                style, effect, baseOpacity, uppercase, highlightColor,
                                // Remotion data
                                remotion: useRemotionPreview ? subtitleConfig : null,
                                captions: textEdited ? captions : null,
                            };
                            const bulkRunning = bulkProgress?.running;
                            return (
                                <>
                                    <div className="flex gap-2">
                                        <button onClick={onClose} className="btn-ghost">
                                            cancel
                                        </button>
                                        <button
                                            onClick={() => onGenerate(styleOptions)}
                                            disabled={isProcessing}
                                            className="btn-primary flex-1"
                                        >
                                            {(isProcessing && !bulkRunning) && <Loader2 size={16} className="animate-spin text-brassink" />}
                                            {(isProcessing && !bulkRunning) ? 'generating...' : 'apply to this clip'}
                                        </button>
                                    </div>
                                    {onApplyAll && bulkCount > 1 && (
                                        <button
                                            onClick={() => onApplyAll({ ...styleOptions, captions: null })}
                                            disabled={isProcessing}
                                            className="btn-ghost w-full flex items-center justify-center gap-2"
                                        >
                                            {bulkRunning
                                                ? <><Loader2 size={16} className="animate-spin" />applying to all… {bulkProgress.current}/{bulkProgress.total}</>
                                                : `apply this style to all ${bulkCount} clips`}
                                        </button>
                                    )}
                                    {/* Clips ship captioned by default, so the way
                                        out has to be here — otherwise a user who
                                        doesn't want captions is stuck with them. */}
                                    {onRemove && (
                                        <button
                                            onClick={onRemove}
                                            disabled={isProcessing}
                                            className="text-xs text-muted underline underline-offset-2 lowercase hover:text-ink2 disabled:opacity-50"
                                        >
                                            remove captions from this clip
                                        </button>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
