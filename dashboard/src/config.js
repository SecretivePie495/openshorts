// Configuration for API endpoints
// If VITE_API_URL is set (e.g. in production), use it.
// Otherwise, default to empty string which means relative paths (proxied in dev).

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Prefixes whose bytes the server checks ownership on (see media_auth.py).
// A <video src> or <img src> cannot send an Authorization header, so these —
// and only these — carry the short-lived media token in the query string.
// Scoping it here keeps the token out of ordinary API requests, their access
// logs and their referrers.
const MEDIA_PREFIXES = ['/videos/', '/thumbnails/'];

// Module-level rather than React state on purpose: getApiUrl is called from
// render paths all over the app, and every URL built after the token lands
// carries it. Ones built before stay valid until they expire on their own.
let mediaToken = '';

export const setMediaToken = (token) => { mediaToken = token || ''; };

export const getApiUrl = (path) => {
    if (path.startsWith('http')) return path;
    // Ensure path starts with / if not present
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${API_BASE_URL}${normalizedPath}`;
    if (!mediaToken || !MEDIA_PREFIXES.some((p) => normalizedPath.startsWith(p))) {
        return url;
    }
    return `${url}${url.includes('?') ? '&' : '?'}mt=${encodeURIComponent(mediaToken)}`;
};
