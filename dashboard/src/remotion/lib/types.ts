import { z } from "zod";

// --- Word-level caption ---
export interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
}

// --- Subtitle config ---
export type SubtitleAnimation = "none" | "word-highlight" | "pop" | "karaoke" | "scale-in";
export type SubtitlePosition = "top" | "middle" | "bottom";

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  highlightColor: string;
  borderColor: string;
  borderWidth: number;
  bgColor: string;
  bgOpacity: number;
  animation: SubtitleAnimation;
  // Karaoke look: dim inactive words (0-1) and force uppercase.
  baseOpacity?: number;
  uppercase?: boolean;
  // Distance from the top/bottom edge, in ASS PlayResY=288 units (matches
  // subtitles.py's SAFE_MARGIN_V=43) — ignored when position is "middle".
  marginV?: number;
}

export interface SubtitleConfig {
  captions: CaptionWord[];
  position: SubtitlePosition;
  style: SubtitleStyle;
  // Free-drag center point (0-1 of frame width/height). Overrides `position`
  // when set. Preview/in-browser render only — the server ASS burn has no
  // horizontal placement (subtitles.py centers every line), so a clip that
  // falls back to that path renders centered with only the vertical
  // component approximated via style.marginV.
  xPct?: number;
  yPct?: number;
}

// --- Hook config ---
export type HookPosition = "top" | "center" | "bottom";
export type HookSize = "S" | "M" | "L";
export type HookEntrance = "spring" | "fade" | "slide-up" | "none";
export type HookStyle =
  | "classic"
  | "dark"
  | "yellow"
  | "red"
  | "outline"
  | "outline_yellow";

export interface HookConfig {
  text: string;
  position: HookPosition;
  size: HookSize;
  style?: HookStyle;
  entranceAnimation: HookEntrance;
  displayDurationSec: number;
  // Free-drag center point (0-1 of frame width/height). Overrides `position` when set.
  xPct?: number;
  yPct?: number;
}

// --- Effects config ---
export interface EffectSegment {
  startSec: number;
  endSec: number;
  zoom: number;
  zoomCenterX: number;
  zoomCenterY: number;
  brightness: number;
  contrast: number;
  saturate: number;
}

export interface EffectsConfig {
  segments: EffectSegment[];
}

// --- Logo config ---
export type LogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface LogoConfig {
  url: string; // data URL (base64) or absolute path for server burn
  position: LogoPosition;
  scale: number; // 0.2 to 2.0
  opacity: number; // 0 to 1
}

// --- Main composition props ---
export interface ShortVideoProps {
  videoUrl: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  subtitles: SubtitleConfig | null;
  hook: HookConfig | null;
  effects: EffectsConfig | null;
  logo: LogoConfig | null;
}

// --- Zod schemas for validation (used by render service) ---
export const captionWordSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
});

export const subtitleStyleSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number(),
  fontColor: z.string(),
  highlightColor: z.string(),
  borderColor: z.string(),
  borderWidth: z.number(),
  bgColor: z.string(),
  bgOpacity: z.number().min(0).max(1),
  animation: z.enum(["none", "word-highlight", "pop", "karaoke", "scale-in"]),
  baseOpacity: z.number().min(0).max(1).optional(),
  uppercase: z.boolean().optional(),
  marginV: z.number().min(0).max(200).optional(),
});

export const subtitleConfigSchema = z.object({
  captions: z.array(captionWordSchema),
  position: z.enum(["top", "middle", "bottom"]),
  style: subtitleStyleSchema,
  xPct: z.number().min(0).max(1).optional(),
  yPct: z.number().min(0).max(1).optional(),
});

export const hookConfigSchema = z.object({
  text: z.string(),
  position: z.enum(["top", "center", "bottom"]),
  size: z.enum(["S", "M", "L"]),
  style: z
    .enum(["classic", "dark", "yellow", "red", "outline", "outline_yellow"])
    .default("classic"),
  entranceAnimation: z.enum(["spring", "fade", "slide-up", "none"]),
  displayDurationSec: z.number().positive(),
  xPct: z.number().min(0).max(1).optional(),
  yPct: z.number().min(0).max(1).optional(),
});

export const effectSegmentSchema = z.object({
  startSec: z.number().min(0),
  endSec: z.number().positive(),
  zoom: z.number().min(0.5).max(3),
  zoomCenterX: z.number().min(0).max(1),
  zoomCenterY: z.number().min(0).max(1),
  brightness: z.number().min(0).max(3),
  contrast: z.number().min(0).max(3),
  saturate: z.number().min(0).max(3),
});

export const effectsConfigSchema = z.object({
  segments: z.array(effectSegmentSchema),
});

export const shortVideoPropsSchema = z.object({
  videoUrl: z.string(),
  durationInFrames: z.number().int().positive(),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  subtitles: subtitleConfigSchema.nullable(),
  hook: hookConfigSchema.nullable(),
  effects: effectsConfigSchema.nullable(),
  logo: z
    .object({
      url: z.string(),
      position: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]),
      scale: z.number().min(0.2).max(2),
      opacity: z.number().min(0).max(1),
    })
    .nullable(),
});
