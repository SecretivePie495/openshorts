import React, { useState, useEffect, useReducer, useRef, useCallback, useMemo, useDeferredValue } from 'react';
import { getApiUrl } from '../config';
import { apiFetch, apiJson, QuotaError } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const MIN_SEGMENT_SECONDS = 0.5;
const SNAP_WINDOW_SECONDS = 0.35;
const HIDE_SOURCE_KEY = 'openshorts_editor_hide_source';
const CHUNK_WORDS = 50;
const COVERAGE_EPSILON = 0.02;

const SEGMENT_COLORS = [
    'oklch(76% .17 50)',
    'oklch(70% .12 200)',
    'oklch(72% .13 140)',
    'oklch(70% .14 300)',
    'oklch(74% .13 90)',
    'oklch(68% .13 250)',
];

function fmt(t) {
    if (!Number.isFinite(t)) return '–:––';
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function totalOf(segments) {
    return segments.reduce((acc, s) => acc + (s.end - s.start), 0);
}

function editorReducer(state, action) {
    switch (action.type) {
        // init: replaces the whole recipe (used when render commits back).
        // pre-drag preview: replaces segments without touching history;
        // snapshot is kept so whole drag undoes as ONE step.
        case 'init':
            return { ...state, segments: action.segments, selected: 0, pendingBase: null };
        case 'select':
            return { ...state, selected: action.index };
        case 'preview':
            return { ...state, segments: action.segments, pendingBase: state.pendingBase || state.segments };
        case 'commit': {
            const base = state.pendingBase || state.segments;
            return {
                ...state,
                segments: action.segments,
                selected: Math.min(action.select ?? state.selected, action.segments.length - 1),
                past: [...state.past, base],
                future: [],
                pendingBase: null,
            };
        }
        case 'undo': {
            if (!state.past.length) return state;
            const prev = state.past[state.past.length - 1];
            return {
                ...state,
                segments: prev,
                selected: Math.min(state.selected, prev.length - 1),
                past: state.past.slice(0, -1),
                future: [state.segments, ...state.future],
                pendingBase: null,
            };
        }
        case 'redo': {
            if (!state.future.length) return state;
            const next = state.future[0];
            return {
                ...state,
                segments: next,
                selected: Math.min(state.selected, next.length - 1),
                past: [...state.past, state.segments],
                future: state.future.slice(1),
                pendingBase: null,
            };
        }
        default:
            return state;
    }
}

export default function useEditorEngine({ jobId, clipIndex, onClose, onRerendered, onRenderQueued }) {
    const { refreshMe } = useAuth();
    const [edl, setEdl] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [reload, setReload] = useState(0);
    const [state, dispatch] = useReducer(editorReducer, {
        segments: [], selected: 0, past: [], future: [], pendingBase: null,
    });
    const { segments, selected } = state;

    const [snapToWords, setSnapToWords] = useState(true);
    const [reapplyCaptions, setReapplyCaptions] = useState(true);
    const [framing, setFraming] = useState('auto');
    const [renderedFraming, setRenderedFraming] = useState('auto');
    const [renderedSegments, setRenderedSegments] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [rendering, setRendering] = useState(false);
    const [renderSeconds, setRenderSeconds] = useState(0);
    const [renderError, setRenderError] = useState(null);
    const [confirmClose, setConfirmClose] = useState(false);
    const [showEffects, setShowEffects] = useState(false);
    const [effectsState, setEffectsState] = useState({});
    const [selectedWord, setSelectedWord] = useState(null);
    const [playhead, setPlayhead] = useState(0);
    const [showSource, setShowSource] = useState(() => {
        try { return localStorage.getItem(HIDE_SOURCE_KEY) !== '1'; } catch { return true; }
    });
    const [sourceTime, setSourceTime] = useState(0);
    const [markIn, setMarkIn] = useState(null);
    const [markOut, setMarkOut] = useState(null);
    const [ghost, setGhost] = useState(null);
    const [paintNote, setPaintNote] = useState(null);

    const renderingRef = useRef(false);
    useEffect(() => { renderingRef.current = rendering; }, [rendering]);

    const segmentsRef = useRef(segments);
    useEffect(() => { segmentsRef.current = segments; }, [segments]);
    const limits = useMemo(() => edl?.limits || { max_segments: 12, min_segment_seconds: MIN_SEGMENT_SECONDS, max_total_seconds: 180 }, [edl]);
    const limitsRef = useRef(limits);
    useEffect(() => { limitsRef.current = limits; }, [limits]);

    useEffect(() => {
        try { localStorage.setItem(HIDE_SOURCE_KEY, showSource ? '0' : '1'); } catch { /* private mode */ }
    }, [showSource]);

    // ---- load EDL ---------------------------------------------------------
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await apiJson(`/api/clip/${jobId}/${clipIndex}/edl`);
                if (cancelled) return;
                dispatch({ type: 'init', segments: data.segments.map((s) => ({ ...s })) });
                setRenderedSegments(data.segments.map((s) => ({ ...s })));
                setFraming(data.framing || 'auto');
                setRenderedFraming(data.framing || 'auto');
                setReapplyCaptions(true);
                setPreviewUrl(getApiUrl(`/videos/${jobId}/${data.current_file}`));
                setEdl(data);
            } catch (e) {
                if (!cancelled) setLoadError(e.detail || e.message || 'could not load clip recipe');
            }
        })();
        return () => { cancelled = true; };
    }, [jobId, clipIndex, reload]);

    const words = useMemo(() => (edl?.words || []), [edl]);
    const sourceAvailable = !!edl?.source?.available;
    const sourceDuration = edl?.source?.duration || 0;
    const canonical = useMemo(() => edl?.canonical_range || { start: 0, end: 0 }, [edl]);
    const minSeg = limits.min_segment_seconds || MIN_SEGMENT_SECONDS;
    const total = totalOf(segments);
    const sourceOpen = sourceAvailable && showSource;
    const bounds = useMemo(
        () => ({ lo: canonical.start, hi: canonical.end }),
        [canonical]
    );

    const dirty = useMemo(() => {
        if (!renderedSegments) return false;
        return JSON.stringify(segments) !== JSON.stringify(renderedSegments)
            || framing !== renderedFraming;
    }, [segments, renderedSegments, framing, renderedFraming]);

    const outOfRange = useCallback((seg) =>
        !sourceAvailable && (seg.start < canonical.start - 0.05 || seg.end > canonical.end + 0.05)
    , [sourceAvailable, canonical]);

    const needsSourcePath = framing !== 'auto'
        || segments.some((s) => s.start < canonical.start - 0.05 || s.end > canonical.end + 0.05);
    const invalidSegments = segments.some(outOfRange);
    const overCaps = segments.length >= limits.max_segments || total > limits.max_total_seconds;
    const canRender = !rendering
        && segments.length > 0
        && segments.every((s) => s.end - s.start >= minSeg)
        && !invalidSegments
        && !overCaps;

    // ---- word snap ---------------------------------------------------------
    const snapEdge = useCallback((t, kind) => {
        if (!snapToWords || !words.length) return t;
        let best = null;
        for (const w of words) {
            const c = kind === 'start' ? w.s : w.e;
            if (Math.abs(c - t) <= SNAP_WINDOW_SECONDS && (best === null || Math.abs(c - t) < Math.abs(best - t))) best = c;
        }
        return best ?? t;
    }, [snapToWords, words]);

    const clampSeg = useCallback((seg) => ({
        start: Math.max(bounds.lo, Math.min(seg.start, seg.end - minSeg)),
        end: Math.min(bounds.hi, Math.max(seg.end, seg.start + minSeg)),
    }), [bounds.lo, bounds.hi, minSeg]);

    const setSegment = (index, next, { snap = true } = {}) => {
        if (renderingRef.current) return;
        const updated = segments.map((s, i) => {
            if (i !== index) return s;
            const seg = { ...s, ...next };
            if (snap) {
                if (next.start !== undefined) seg.start = snapEdge(seg.start, 'start');
                if (next.end !== undefined) seg.end = snapEdge(seg.end, 'end');
            }
            return clampSeg(seg);
        });
        dispatch({ type: 'commit', segments: updated, select: index });
    };

    const addSegment = () => {
        if (renderingRef.current) return;
        if (segments.length >= limits.max_segments) return;
        const last = segments[segments.length - 1];
        let start = last ? last.end : bounds.lo;
        let end = start + 10;
        if (end > bounds.hi) { end = bounds.hi; start = Math.max(bounds.lo, end - 10); }
        if (end - start < minSeg) return;
        dispatch({ type: 'commit', segments: [...segments, { start: Math.round(start * 1000) / 1000, end: Math.round(end * 1000) / 1000 }], select: segments.length });
    };

    const deleteSegment = (index) => {
        if (renderingRef.current) return;
        if (segments.length <= 1) return;
        dispatch({ type: 'commit', segments: segments.filter((_, i) => i !== index), select: Math.max(0, index - 1) });
    };

    const moveSegment = (index, dir) => {
        if (renderingRef.current) return;
        const j = index + dir;
        if (j < 0 || j >= segments.length) return;
        const next = segments.slice();
        [next[index], next[j]] = [next[j], next[index]];
        dispatch({ type: 'commit', segments: next, select: j });
    };

    const splitSegment = (index) => {
        if (renderingRef.current) return;
        if (segments.length >= limits.max_segments) return;
        const seg = segments[index];
        if (seg.end - seg.start < minSeg * 2) return;
        let at = seg.start + (seg.end - seg.start) / 2;
        let offset = 0;
        for (let i = 0; i < segments.length; i += 1) {
            const len = segments[i].end - segments[i].start;
            if (i === index && playhead > offset + minSeg && playhead < offset + len - minSeg) {
                at = segments[i].start + (playhead - offset);
            }
            offset += len;
        }
        at = snapEdge(at, 'end');
        if (at - seg.start < minSeg || seg.end - at < minSeg) at = seg.start + (seg.end - seg.start) / 2;
        const next = segments.flatMap((s, i) => (i === index
            ? [{ start: s.start, end: Math.round(at * 1000) / 1000 }, { start: Math.round(at * 1000) / 1000, end: s.end }]
            : [s]));
        dispatch({ type: 'commit', segments: next, select: index });
    };

    // ---- drag: trim/move handles -------------------------------------------
    const dragRef = useRef(null);

    const onDragMove = useCallback((e) => {
        const d = dragRef.current;
        if (!d || d.kind) return;   // a ghost or a scrub, not a trim
        const dt = (e.clientX - d.startX) / d.pxPerSec;
        const seg = { ...d.base[d.idx] };
        if (d.edge === 'move') {
            const len = seg.end - seg.start;
            seg.start = Math.max(d.lo, Math.min(seg.start + dt, d.hi - len));
            seg.end = seg.start + len;
        } else if (d.edge === 'start') {
            seg.start = Math.max(d.lo, Math.min(seg.start + dt, seg.end - d.minSeg));
        } else {
            seg.end = Math.min(d.hi, Math.max(seg.end + dt, seg.start + d.minSeg));
        }
        if (d.scrub) d.seek(d.edge === 'end' ? seg.end : seg.start);
        const next = d.base.map((s, i) => (i === d.idx ? seg : s));
        d.last = { seg, next };
        dispatch({ type: 'preview', segments: next });
    }, []);

    const onDragUp = useCallback(() => {
        const d = dragRef.current;
        dragRef.current = null;
        window.removeEventListener('pointermove', onDragMove);
        window.removeEventListener('pointerup', onDragUp);
        window.removeEventListener('pointercancel', onDragUp);
        if (!d || !d.last) return;
        const { seg, next } = d.last;
        const snapped = { ...seg };
        if (d.edge === 'move') {
            const len = seg.end - seg.start;
            const start = Math.max(d.lo, Math.min(d.snap(seg.start, 'start'), d.hi - len));
            snapped.start = start;
            snapped.end = start + len;
        } else if (d.edge === 'start') {
            snapped.start = Math.max(d.lo, Math.min(d.snap(seg.start, 'start'), seg.end - d.minSeg));
        } else {
            snapped.end = Math.min(d.hi, Math.max(d.snap(seg.end, 'end'), seg.start + d.minSeg));
        }
        const clean = { start: Math.round(snapped.start * 1000) / 1000, end: Math.round(snapped.end * 1000) / 1000 };
        dispatch({ type: 'commit', segments: next.map((s, i) => (i === d.idx ? clean : s)), select: d.idx });
    }, [onDragMove]);

    const startTrimDrag = (e, idx, edge, trackEl, secondsOnTrack) => {
        if (rendering) return;
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = trackEl?.getBoundingClientRect();
        if (!rect || !secondsOnTrack) return;
        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* not captured, window listeners still fire */ }
        const scrub = trackEl === sourceTrackRef.current;
        if (scrub) {
            const seg = segments[idx];
            if (seg) seekSource(edge === 'end' ? seg.end : seg.start);
        }
        dragRef.current = {
            idx, edge, startX: e.clientX, pxPerSec: rect.width / secondsOnTrack,
            base: segments.map((s) => ({ ...s })), last: null,
            lo: bounds.lo, hi: bounds.hi, minSeg, snap: snapEdge,
            scrub, seek: seekSource,
        };
        dispatch({ type: 'select', index: idx });
        window.addEventListener('pointermove', onDragMove);
        window.addEventListener('pointerup', onDragUp);
        window.addEventListener('pointercancel', onDragUp);
    };

    // ---- drag: paint NEW segment on source ----------------------------------
    const onGhostMove = useCallback((e) => {
        const d = dragRef.current;
        if (!d || d.kind !== 'ghost') return;
        const t = Math.max(0, Math.min(d.duration, d.t0 + (e.clientX - d.startX) / d.pxPerSec));
        d.seek(t);
        d.range = { start: Math.min(d.t0, t), end: Math.max(d.t0, t) };
        setGhost({ ...d.range });
    }, []);

    const onGhostUp = useCallback(() => {
        const d = dragRef.current;
        dragRef.current = null;
        window.removeEventListener('pointermove', onGhostMove);
        window.removeEventListener('pointerup', onGhostUp);
        window.removeEventListener('pointercancel', onGhostUp);
        setGhost(null);
        if (!d || !d.range) return;
        const seg = {
            start: Math.round(d.snap(d.range.start, 'start') * 1000) / 1000,
            end: Math.round(d.snap(d.range.end, 'end') * 1000) / 1000,
        };
        if (seg.end - seg.start < d.minSeg) return;
        if (renderingRef.current) return;
        setPaintNote(null);
        const base = segmentsRef.current;
        const hit = base.findIndex((s) => seg.start >= s.start - 0.05 && seg.end <= s.end + 0.05);
        if (hit >= 0) {
            const updated = base.map((s, i) => (i === hit ? seg : s));
            dispatch({ type: 'commit', segments: updated, select: hit });
            return;
        }
        if (base.length >= limitsRef.current.max_segments) {
            setPaintNote(`segment cap (${limitsRef.current.max_segments}) — replace one instead: i/O marks, then send`);
            return;
        }
        const after = base.filter((s) => s.end <= seg.start).length;
        const next = base.slice();
        next.splice(after, 0, seg);
        dispatch({ type: 'commit', segments: next, select: after });
    }, [onGhostMove]);

    const startGhostDrag = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (rendering) return;
        if (!sourceAvailable || !sourceDuration) return;
        const rect = sourceTrackRef.current?.getBoundingClientRect();
        if (!rect) return;
        e.preventDefault();
        const t0 = ((e.clientX - rect.left) / rect.width) * sourceDuration;
        seekSource(t0);
        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* window listeners still fire */ }
        dragRef.current = {
            kind: 'ghost', startX: e.clientX, pxPerSec: rect.width / sourceDuration,
            t0, duration: sourceDuration, range: null, snap: snapEdge, minSeg,
            seek: seekSource,
        };
        window.addEventListener('pointermove', onGhostMove);
        window.addEventListener('pointerup', onGhostUp);
        window.addEventListener('pointercancel', onGhostUp);
    };

    // ---- refs ----------------------------------------------------------------
    const videoRef = useRef(null);
    const sourceRef = useRef(null);
    const clipTrackRef = useRef(null);
    const sourceTrackRef = useRef(null);
    const transcriptRef = useRef(null);
    const playSpanRef = useRef(0);

    // ---- scrubbing source monitor ------------------------------------------
    const seekRef = useRef({ pending: null, raf: 0, timer: 0 });

    const applySeek = useCallback(() => {
        if (seekRef.current.raf) cancelAnimationFrame(seekRef.current.raf);
        if (seekRef.current.timer) clearTimeout(seekRef.current.timer);
        seekRef.current.raf = 0;
        seekRef.current.timer = 0;
        const v = sourceRef.current;
        const t = seekRef.current.pending;
        if (!v || t === null) return;
        if (v.readyState === 0) return; // retried from onLoadedMetadata
        if (!v.paused) v.pause();
        try { v.currentTime = Math.max(0, t); } catch { /* seek refused, keep pending */ }
        seekRef.current.pending = null;
    }, []);

    const seekSource = useCallback((t) => {
        if (!Number.isFinite(t)) return;
        seekRef.current.pending = t;
        if (seekRef.current.raf || seekRef.current.timer) return;
        seekRef.current.raf = requestAnimationFrame(applySeek);
        seekRef.current.timer = setTimeout(applySeek, 120);
    }, [applySeek]);

    // ---- coverage engine ---------------------------------------------------
    const coverage = useMemo(() => {
        if (!segments.length) return [];
        if (!renderedSegments || framing !== renderedFraming) {
            return [{ start: 0, end: totalOf(segments), rendered: null }];
        }
        const spans = [];
        let clipAcc = 0;
        for (const seg of segments) {
            const segLen = seg.end - seg.start;
            const pieces = [];
            let renAcc = 0;
            for (const r of renderedSegments) {
                const lo = Math.max(seg.start, r.start);
                const hi = Math.min(seg.end, r.end);
                if (hi - lo > COVERAGE_EPSILON) {
                    pieces.push({ lo, hi, rendered: renAcc + (lo - r.start) });
                }
                renAcc += r.end - r.start;
            }
            pieces.sort((a, b) => a.lo - b.lo);

            let cursor = seg.start;
            for (const piece of pieces) {
                const lo = Math.max(piece.lo, cursor);
                if (piece.hi - lo <= COVERAGE_EPSILON) continue;
                if (lo - cursor > COVERAGE_EPSILON) {
                    spans.push({
                        start: clipAcc + (cursor - seg.start),
                        end: clipAcc + (lo - seg.start),
                        rendered: null,
                    });
                }
                spans.push({
                    start: clipAcc + (lo - seg.start),
                    end: clipAcc + (piece.hi - seg.start),
                    rendered: piece.rendered + (lo - piece.lo),
                });
                cursor = piece.hi;
            }
            if (seg.end - cursor > COVERAGE_EPSILON) {
                spans.push({
                    start: clipAcc + (cursor - seg.start),
                    end: clipAcc + segLen,
                    rendered: null,
                });
            }
            clipAcc += segLen;
        }
        return spans;
    }, [segments, renderedSegments, framing, renderedFraming]);

    const missingSeconds = useMemo(() => coverage.reduce(
        (acc, sp) => (sp.rendered === null ? acc + (sp.end - sp.start) : acc), 0), [coverage]);

    const spanIndexAt = useCallback((t) => {
        const i = coverage.findIndex((sp) => t >= sp.start - COVERAGE_EPSILON && t < sp.end);
        return i >= 0 ? i : coverage.length - 1;
    }, [coverage]);

    const clipToRendered = useCallback((t) => {
        const sp = coverage[spanIndexAt(t)];
        if (!sp || sp.rendered === null) return null;
        const offset = Math.max(0, Math.min(t - sp.start, sp.end - sp.start));
        return sp.rendered + offset;
    }, [coverage, spanIndexAt]);

    const renderedToClip = useCallback((r) => {
        for (const sp of coverage) {
            if (sp.rendered === null) continue;
            const end = sp.rendered + (sp.end - sp.start);
            if (r >= sp.rendered - COVERAGE_EPSILON && r <= end + COVERAGE_EPSILON) {
                return sp.start + (r - sp.rendered);
            }
        }
        return null;
    }, [coverage]);

    const hasCovered = useMemo(
        () => coverage.some((sp) => sp.rendered !== null), [coverage]);

    const clampToCovered = useCallback((t, from, { path = false } = {}) => {
        if (!hasCovered) return t;
        const forward = t >= from;

        let wall = null;
        if (path) {
            wall = forward
                ? coverage.find((sp) => sp.rendered === null
                    && sp.end > from + COVERAGE_EPSILON && sp.start < t - COVERAGE_EPSILON)
                : [...coverage].reverse().find((sp) => sp.rendered === null
                    && sp.start < from - COVERAGE_EPSILON && sp.end > t + COVERAGE_EPSILON);
        }
        if (!wall) {
            const sp = coverage[spanIndexAt(t)];
            if (!sp || sp.rendered !== null) return t;
            wall = sp;
        }

        let lo = coverage.indexOf(wall);
        let hi = lo;
        while (lo > 0 && coverage[lo - 1].rendered === null) lo -= 1;
        while (hi < coverage.length - 1 && coverage[hi + 1].rendered === null) hi += 1;
        const near = Math.max(0, coverage[lo].start - 0.001);
        const far = coverage[hi].end;
        const hasBefore = lo > 0;
        const hasAfter = hi < coverage.length - 1;

        if (forward) return hasBefore ? near : (hasAfter ? far : t);
        return hasAfter ? far : (hasBefore ? near : t);
    }, [coverage, hasCovered, spanIndexAt]);

    useEffect(() => {
        setPlayhead((t) => {
            const clamped = clampToCovered(t, t);
            return clamped === t ? t : clamped;
        });
        setPlayhead((t) => { playSpanRef.current = spanIndexAt(t); return t; });
    }, [clampToCovered, spanIndexAt]);

    // ---- playback loop -----------------------------------------------------
    const playRafRef = useRef(0);
    const stopPlayLoop = useCallback(() => {
        if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
        playRafRef.current = 0;
    }, []);
    const startPlayLoop = useCallback(() => {
        stopPlayLoop();
        const tick = () => {
            const v = videoRef.current;
            if (!v || v.paused || v.ended) { playRafRef.current = 0; return; }
            stepPlayback(v);
            playRafRef.current = requestAnimationFrame(tick);
        };
        playRafRef.current = requestAnimationFrame(tick);
    }, [stepPlayback, stopPlayLoop]);
    useEffect(() => stopPlayLoop, [stopPlayLoop]);

    const stepPlayback = useCallback((v) => {
        if (dragRef.current?.kind === 'scrub') return;
        if (!dirty) { setPlayhead(v.currentTime); return; }

        let i = playSpanRef.current;
        let sp = coverage[i];
        if (!sp) return;

        const spEnd = sp.rendered !== null ? sp.rendered + (sp.end - sp.start) : null;
        if (spEnd !== null && v.currentTime < spEnd - COVERAGE_EPSILON) {
            setPlayhead(sp.start + (v.currentTime - sp.rendered));
            return;
        }

        i += 1;
        const next = coverage[i];
        if (!next || next.rendered === null) {
            v.pause();
            if (spEnd !== null) { try { v.currentTime = spEnd; } catch { /* not seekable yet */ } }
            setPlayhead(next ? next.start : totalOf(segments));
            if (next) playSpanRef.current = i;
            return;
        }
        playSpanRef.current = i;
        setPlayhead(next.start);
        try { v.currentTime = next.rendered; } catch { /* not seekable yet */ }
    }, [coverage, dirty, segments]);

    const onClipTimeUpdate = useCallback((e) => stepPlayback(e.target), [stepPlayback]);

    const onClipSeeked = useCallback((e) => {
        if (!dirty || dragRef.current?.kind === 'scrub') return;
        const t = renderedToClip(e.target.currentTime);
        if (t === null) return;
        playSpanRef.current = spanIndexAt(t);
        setPlayhead(t);
        // Stop at uncovered edges.
        const sp = coverage[playSpanRef.current];
        if (!sp || sp.rendered === null) e.target.pause();
    }, [coverage, dirty, startPlayLoop, renderedToClip, spanIndexAt]);

    const onClipPlay = useCallback((e) => {
        const v = e.target;
        if (dirty) startPlayLoop();
    }, [dirty, startPlayLoop]);

    // ---- scrubbing clip track ---------------------------------------------
    const onScrubMove = useCallback((e) => {
        const d = dragRef.current;
        if (!d || d.kind !== 'scrub') return;
        d.apply(d.at(e.clientX), { path: true });
    }, []);

    const onScrubUp = useCallback(() => {
        dragRef.current = null;
        window.removeEventListener('pointermove', onScrubMove);
        window.removeEventListener('pointerup', onScrubUp);
        window.removeEventListener('pointercancel', onScrubUp);
    }, [onScrubMove]);

    const startClipScrub = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        const rect = clipTrackRef.current?.getBoundingClientRect();
        if (!rect || !clipTrackSeconds) return;
        e.preventDefault();
        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* window listeners still fire */ }

        const total = clipTrackSeconds;
        const at = (clientX) => Math.max(0, Math.min(
            total, ((clientX - rect.left) / rect.width) * clipTrackSeconds));
        let last = playhead;
        const apply = (raw, { path = false } = {}) => {
            const t = clampToCovered(raw, last, { path });
            last = t;
            setPlayhead(t);
            const r = clipToRendered(t);
            playSpanRef.current = spanIndexAt(t);
            if (r !== null && videoRef.current) {
                videoRef.current.currentTime = r;
            }
        };

        apply(at(e.clientX));
        dragRef.current = {
            kind: 'scrub', at, apply,
        };
        window.addEventListener('pointermove', onScrubMove);
        window.addEventListener('pointerup', onScrubUp);
        window.addEventListener('pointercancel', onScrubUp);
    };

    // ---- three-point in/out -----------------------------------------------
    const round3 = (t) => Math.round(t * 1000) / 1000;

    const markHere = (which) => {
        const v = sourceRef.current;
        if (!v || !Number.isFinite(v.currentTime)) return;
        (which === 'in' ? setMarkIn : setMarkOut)(round3(v.currentTime));
    };

    const clearMarks = () => { setMarkIn(null); setMarkOut(null); };

    const markRange = useMemo(() => {
        if (markIn === null || markOut === null) return null;
        const lo = Math.min(markIn, markOut);
        const hi = Math.max(markIn, markOut);
        return hi - lo >= minSeg ? { start: round3(lo), end: round3(hi) } : null;
    }, [markIn, markOut, minSeg]);

    const sendToClip = (mode) => {
        if (!markRange || renderingRef.current) return;
        if (mode === 'replace') {
            dispatch({
                type: 'commit',
                segments: segments.map((s, i) => (i === selected ? { ...markRange } : s)),
                select: selected,
            });
            return;
        }
        if (segments.length >= limits.max_segments) return;
        const next = segments.slice();
        next.splice(selected + 1, 0, { ...markRange });
        dispatch({ type: 'commit', segments: next, select: selected + 1 });
    };

    // ---- keyboard ---------------------------------------------------------
    useEffect(() => {
        const onKey = (e) => {
            const tag = e.target?.tagName;
            const typing = tag === 'INPUT' || tag === 'textarea' || tag === 'select';
            if (typing) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                if (rendering) onClose();
                else if (dirty) setConfirmClose(true);
                else onClose();
                return;
            }
            if (confirmClose) return;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (!rendering) dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const seg = segments[selected];
                if (!seg || rendering) return;
                const step = e.altKey ? 0.01 : 0.1;
                const edge = e.shiftKey ? 'end' : 'start';
                const delta = (e.key === 'ArrowRight' ? step : -step);
                setSegment(selected, { [edge]: Math.round((seg[edge] + delta) * 1000) / 1000 }, { snap: false });
            } else if (e.key === ' ') {
                if ((e.target?.tagName || '').toLowerCase() === 'video') return;
                e.preventDefault();
                const v = videoRef.current;
                if (v) { if (v.paused) v.play().catch(() => {}); else v.pause(); }
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                deleteSegment(selected);
            } else if (e.key.toLowerCase() === 's') {
                e.preventDefault();
                splitSegment(selected);
            } else if (sourceOpen && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                markHere('in');
            } else if (sourceOpen && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                markHere('out');
            } else if (sourceOpen && e.key === ',') {
                e.preventDefault();
                sendToClip('insert');
            } else if (sourceOpen && e.key === '.') {
                e.preventDefault();
                sendToClip('replace');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [segments, selected, sourceOpen, confirmClose, rendering, dirty, onClose]);

    // ---- re-render ---------------------------------------------------------
    useEffect(() => {
        if (!rendering) return undefined;
        setRenderSeconds(0);
        const t = setInterval(() => setRenderSeconds((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, [rendering]);

    const buildRequest = () => ({
        job_id: jobId,
        clip_index: clipIndex,
        segments: segments.map((s) => ({ start: s.start, end: s.end })),
        snap_to_words: false,
        reapply_captions: reapplyCaptions,
        framing,
        sync: false,
        ...effectsState,
    });

    const doRender = async (useAdvanced = false) => {
        if (!canRender) return;
        setRendering(true);
        setRenderError(null);
        try {
            const endpoint = useAdvanced ? '/api/clip/advanced/edit' : '/api/clip/rerender';
            const res = await apiFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildRequest()),
            });
            if (!res.ok) {
                let detail = `re-render failed (HTTP ${res.status})`;
                try { detail = (await res.json()).detail || detail; } catch { /* keep fallback */ }
                throw new Error(detail);
            }
            const data = await res.json();
            if (data.queued) {
                onRenderQueued?.(clipIndex);
                return;
            }
            if (data.recipe?.segments) {
                setRenderedSegments(data.recipe.segments.map((s) => ({ ...s })));
                setRenderedFraming(data.framing || 'auto');
                setFraming(data.framing || 'auto');
                dispatch({ type: 'init', segments: data.recipe.segments.map((s) => ({ ...s })) });
            }
            if (data.new_video_url) {
                setPreviewUrl(`${getApiUrl(data.new_video_url)}?t=${Date.now()}`);
            }
            onRerendered?.(clipIndex, data);
            refreshMe();
        } catch (e) {
            if (e instanceof QuotaError) {
                refreshMe();
                setRenderError(`not enough minutes left (needs ${e.minutesRequired ?? '?'}, ${e.minutesRemaining ?? 0} remaining)`);
            } else {
                setRenderError(e.message || 're-render failed');
            }
        } finally {
            setRendering(false);
        }
    };

    // ---- transcript data --------------------------------------------------
    const selectedSeg = segments[selected] || null;
    const highlightSeg = useDeferredValue(selectedSeg);
    const anchorIndex = useMemo(() => (
        selectedSeg ? words.findIndex((w) => w.e > selectedSeg.start) : -1
    ), [words, selectedSeg]);

    const activeWordIndex = useMemo(() => {
        let lo = 0;
        let hi = words.length - 1;
        let best = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (words[mid].s <= sourceTime) { best = mid; lo = mid + 1; } else hi = mid - 1;
        }
        return best;
    }, [words, sourceTime]);

    const selectedWordIndex = useMemo(() => (
        selectedWord ? words.findIndex((w) => w.s === selectedWord.s && w.e === selectedWord.e) : -1
    ), [words, selectedWord]);

    const chunks = useMemo(() => {
        const out = [];
        for (let i = 0; i < words.length; i += CHUNK_WORDS) {
            out.push({ offset: i, items: words.slice(i, i + CHUNK_WORDS) });
        }
        return out;
    }, [words]);

    const scrollTranscriptTo = useCallback((selector) => {
        const box = transcriptRef.current;
        if (!box) return;
        const el = box.querySelector(selector);
        if (!el) return;
        box.scrollTop = Math.max(0, el.offsetTop - box.clientHeight / 2);
    }, []);

    useEffect(() => {
        scrollTranscriptTo('[data-anchor="1"]');
    }, [selected, words.length, scrollTranscriptTo]);

    useEffect(() => {
        scrollTranscriptTo('[data-active="1"]');
    }, [activeWordIndex, scrollTranscriptTo]);

    const pickWord = useCallback((w) => {
        setSelectedWord((prev) => (prev && prev.s === w.s && prev.e === w.e ? null : w));
        seekSource(w.s);
    }, [seekSource]);

    const clipTrackSeconds = Math.max(total, totalOf(renderedSegments || []), 0.001);

    return {
        // data
        edl, loadError, reload, setReload,
        segments, selected, dispatch,
        snapToWords, setSnapToWords,
        reapplyCaptions, setReapplyCaptions,
        framing, setFraming,
        renderedFraming, setRenderedFraming,
        renderedSegments, setRenderedSegments,
        previewUrl,
        rendering, renderSeconds, renderError,
        confirmClose, setConfirmClose,
        showEffects, setShowEffects,
        effectsState, setEffectsState,
        selectedWord, setSelectedWord,
        playhead, setPlayhead,
        showSource, setShowSource,
        sourceTime, setSourceTime,
        markIn, setMarkIn, markOut, setMarkOut,
        ghost, setGhost,
        paintNote,
        // refs
        videoRef, sourceRef, clipTrackRef, sourceTrackRef, transcriptRef,
        // computed
        words, sourceAvailable, sourceDuration, canonical, minSeg, total,
        sourceOpen, limits, dirty, outOfRange, needsSourcePath,
        invalidSegments, overCaps, canRender,
        missingSeconds, coverage, clipTrackSeconds,
        markRange, playSpanRef,
        // actions
        setSegment, addSegment, deleteSegment, moveSegment, splitSegment,
        startTrimDrag, startGhostDrag,
        seekSource, doRender,
        markHere, clearMarks, sendToClip,
        scrollTranscriptTo, pickWord,
        onClipTimeUpdate, onClipSeeked, startClipScrub,
        onClipPlay, onStopPlayback,
        onVideoLoadedMetadata: useCallback((e) => {
            const v = e.target;
            if (playhead > 0) v.currentTime = playhead;
        }, [playhead]),
        onEffectsChange: useCallback((next) => setEffectsState(s => ({ ...s, ...next })), []),
        fmt, totalOf,
    };
}
