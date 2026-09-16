import path from "node:path";

/**
 * The local clip a render may read, or null if the URL is not one.
 *
 * `props.videoUrl` reaches the render service straight from the browser —
 * app.py's /api/render forwards the request body verbatim — so an
 * unconstrained value is a URL an end user picked for us to fetch from inside
 * the container: cloud metadata, an internal service, anything routable. The
 * original code fell through to the caller's URL whenever its pattern missed,
 * handing exactly that to headless Chromium.
 *
 * Only a clip on the shared output volume is a legal source, so this resolves
 * to a loopback URL on that volume or refuses.
 */
export function resolveOutputUrl(
  videoUrl: string,
  outputDir: string,
  port: number,
): string | null {
  if (!videoUrl) return null;
  // Drop any query/fragment first — media URLs carry a ?mt= capability token,
  // and the volume is read from disk rather than back through that endpoint.
  const match = videoUrl.split(/[?#]/)[0].match(/\/videos\/([^/]+)\/(.+)$/);
  if (!match) return null;

  const segments = `${match[1]}/${match[2]}`.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) return null;

  // Belt and braces: even with the dot segments gone, let path.resolve have
  // the final say on whether this stayed inside the volume.
  const root = path.resolve(outputDir);
  if (!path.resolve(root, segments.join("/")).startsWith(root + path.sep)) {
    return null;
  }

  return `http://127.0.0.1:${port}/output/${segments.map(encodeURIComponent).join("/")}`;
}
