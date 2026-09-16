import crypto from "node:crypto";
import path from "node:path";

import express from "express";
import type { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { initBundle } from "./bundle.js";
import { executeRender } from "./render-worker.js";
import { resolveOutputUrl } from "./video-source.js";

// --- Render status types ---

export type RenderStatus = "queued" | "rendering" | "done" | "error";

export interface RenderJob {
  renderId: string;
  jobId: string;
  clipIndex: number;
  status: RenderStatus;
  progress: number;
  outputUrl?: string;
  error?: string;
  finishedAt?: number;
}

// In-memory render job map
export const renderJobs = new Map<string, RenderJob>();

// Each render drives a headless Chromium; accepting them all at once is how
// the container OOMs and takes every in-flight render down with it. Extra
// requests queue instead of starting a process.
const MAX_CONCURRENT_RENDERS = parseInt(
  process.env.MAX_CONCURRENT_RENDERS || "2",
  10
);
// Finished renders stay queryable this long so clients can still poll for the
// result, then get swept — the map is otherwise append-only for the life of
// the process.
const FINISHED_JOB_TTL_MS = parseInt(
  process.env.FINISHED_JOB_TTL_MS || "3600000",
  10
);

let activeRenders = 0;
const waiting: Array<() => void> = [];

function runWhenSlotFree(task: () => Promise<void>): void {
  const start = () => {
    activeRenders++;
    void task().finally(() => {
      activeRenders--;
      waiting.shift()?.();
    });
  };
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    start();
  } else {
    waiting.push(start);
  }
}

setInterval(() => {
  const cutoff = Date.now() - FINISHED_JOB_TTL_MS;
  for (const [id, job] of renderJobs) {
    if (job.finishedAt !== undefined && job.finishedAt < cutoff) {
      renderJobs.delete(id);
    }
  }
}, 60_000).unref();

// --- Request validation schema ---

const renderRequestSchema = z.object({
  jobId: z.string().min(1),
  clipIndex: z.number().int().min(0),
  props: z.object({
    videoUrl: z.string(),
    durationInFrames: z.number().int().positive(),
    fps: z.number().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    subtitles: z.any().nullable().optional(),
    hook: z.any().nullable().optional(),
    effects: z.any().nullable().optional(),
  }),
});

// --- Express app ---

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = parseInt(process.env.PORT || "3100", 10);
const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || "/output");
const AUTH_TOKEN = process.env.RENDER_AUTH_TOKEN || "";

// This service renders whatever it is told to, so reaching it is the whole
// exploit. Enforced only when a token is configured, so an existing deployment
// keeps working — but main() shouts about it on every boot until it is set.
function requireToken(req: Request, res: Response, next: NextFunction): void {
  if (!AUTH_TOKEN) return next();
  const header = req.get("authorization") || "";
  const presented = Buffer.from(
    header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(AUTH_TOKEN);
  if (presented.length === expected.length &&
      crypto.timingSafeEqual(presented, expected)) {
    return next();
  }
  res.status(404).end();
}

// The rendered clips of every tenant sit on this volume, and a jobId is
// guessable enough that serving it to the world was an ownership hole. The
// only legitimate reader is the headless Chromium inside this container,
// which fetches over loopback.
function loopbackOnly(req: Request, res: Response, next: NextFunction): void {
  const ip = req.socket.remoteAddress || "";
  if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") {
    return next();
  }
  res.status(404).end();
}

app.use("/output", loopbackOnly, express.static(OUTPUT_DIR));

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Submit a render job
app.post("/render", requireToken, (req, res) => {
  const parsed = renderRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues,
    });
    return;
  }

  const { jobId, clipIndex, props } = parsed.data;

  // Refused up front, with a reason: the old code let a non-matching URL
  // through and the caller only found out via a generic render failure later.
  const resolvedVideoUrl = resolveOutputUrl(props.videoUrl, OUTPUT_DIR, PORT);
  if (!resolvedVideoUrl) {
    res.status(400).json({
      error: "videoUrl must reference a clip on the output volume",
    });
    return;
  }

  const renderId = uuidv4();

  const job: RenderJob = {
    renderId,
    jobId,
    clipIndex,
    status: "queued",
    progress: 0,
  };

  renderJobs.set(renderId, job);

  console.log(
    `[render] Queued render ${renderId} for job=${jobId} clip=${clipIndex}`
  );

  // Runs in the background, but only once a render slot frees up
  runWhenSlotFree(() =>
    executeRender({
      renderId,
      jobId,
      clipIndex,
      props: {
        videoUrl: resolvedVideoUrl,
        durationInFrames: props.durationInFrames,
        fps: props.fps,
        width: props.width,
        height: props.height,
        subtitles: props.subtitles ?? null,
        hook: props.hook ?? null,
        effects: props.effects ?? null,
      },
    })
      .catch((err) => {
        console.error(`[render] Unhandled error for ${renderId}:`, err);
        const existingJob = renderJobs.get(renderId);
        if (existingJob) {
          existingJob.status = "error";
          existingJob.error =
            err instanceof Error ? err.message : "Unknown error";
        }
      })
      .finally(() => {
        const existingJob = renderJobs.get(renderId);
        if (existingJob) existingJob.finishedAt = Date.now();
      })
  );

  res.status(202).json({ renderId, status: "queued" });
});

// Get render status
app.get("/render/:renderId", requireToken, (req, res) => {
  const renderId = String(req.params.renderId);
  const job = renderJobs.get(renderId);

  if (!job) {
    res.status(404).json({ error: "Render not found" });
    return;
  }

  const response: Record<string, unknown> = {
    renderId: job.renderId,
    status: job.status,
  };

  if (job.progress !== undefined) {
    response.progress = job.progress;
  }
  if (job.outputUrl) {
    response.outputUrl = job.outputUrl;
  }
  if (job.error) {
    response.error = job.error;
  }

  res.json(response);
});

// --- Start server ---

async function main() {
  console.log("[render-service] Initializing Remotion bundle...");
  await initBundle();
  console.log("[render-service] Bundle ready.");

  if (!AUTH_TOKEN) {
    console.warn(
      "[render-service] RENDER_AUTH_TOKEN is unset: anyone who can reach " +
      `port ${PORT} can queue renders. Set it here and on the API.`);
  }

  app.listen(PORT, () => {
    console.log(`[render-service] Listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[render-service] Fatal error during startup:", err);
  process.exit(1);
});
