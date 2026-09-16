import assert from "node:assert/strict";
import test from "node:test";

import { resolveOutputUrl } from "./video-source.js";

const OUT = "/output";
const PORT = 3100;

const resolve = (url: string) => resolveOutputUrl(url, OUT, PORT);

test("a clip on the volume resolves to a loopback URL", () => {
  assert.equal(
    resolve("https://api.example.com/videos/job-1/clip_1.mp4"),
    "http://127.0.0.1:3100/output/job-1/clip_1.mp4",
  );
});

test("a capability token on the URL is ignored, not treated as the filename", () => {
  assert.equal(
    resolve("https://api.example.com/videos/job-1/clip_1.mp4?mt=abc.123.def"),
    "http://127.0.0.1:3100/output/job-1/clip_1.mp4",
  );
});

test("a relative URL works too", () => {
  assert.equal(
    resolve("/videos/job-1/clip_1.mp4"),
    "http://127.0.0.1:3100/output/job-1/clip_1.mp4",
  );
});

test("nested paths under the job survive", () => {
  assert.equal(
    resolve("/videos/job-1/nested/clip_1.mp4"),
    "http://127.0.0.1:3100/output/job-1/nested/clip_1.mp4",
  );
});

test("a filename needing escaping is encoded", () => {
  assert.equal(
    resolve("/videos/job-1/my clip.mp4"),
    "http://127.0.0.1:3100/output/job-1/my%20clip.mp4",
  );
});

// The SSRF cases. Every one of these used to fall through and be handed to
// headless Chromium verbatim, because the old code kept the caller's URL
// whenever its pattern missed.
for (const hostile of [
  "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
  "http://localhost:8000/api/me",
  "http://renderer:3100/render",
  "file:///etc/passwd",
  "http://[::1]:6379/",
  "https://evil.example.com/payload.mp4",
  "https://evil.example.com/videos-not-really/clip.mp4",
  "",
]) {
  test(`refuses ${hostile || "(empty)"}`, () => {
    assert.equal(resolve(hostile), null);
  });
}

// Traversal: the point is to stay on the volume even though the /videos/
// prefix matched.
for (const traversal of [
  "/videos/../../etc/passwd",
  "/videos/job-1/../../../etc/passwd",
  "/videos/job-1/../../secrets.env",
  "/videos/./clip.mp4",
  "/videos/job-1//clip.mp4",
]) {
  test(`refuses traversal ${traversal}`, () => {
    assert.equal(resolve(traversal), null);
  });
}
