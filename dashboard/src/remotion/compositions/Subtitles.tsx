import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from "remotion";
import type { SubtitleConfig } from "../lib/types";
import { groupCaptionsIntoBlocks, getActiveWordIndex } from "../lib/captions";
import { getFontStack, subtitlePackFontFace } from "../lib/fonts";

interface SubtitlesProps {
  config: SubtitleConfig;
}

// Matches subtitles.py's SAFE_MARGIN_V (43, in ASS PlayResY=288 units) so the
// preview's default position lines up with the server burn.
const DEFAULT_MARGIN_V = 43;

// "middle" ignores marginV server-side too — libass centers alignment 5
// regardless of MarginV, so there's nothing to keep in sync here.
function positionStyleFor(position: string, marginV: number): React.CSSProperties {
  const pct = `${(marginV / 288) * 100}%`;
  if (position === "top") return { top: pct, bottom: "auto" };
  if (position === "middle") return { top: "45%", bottom: "auto" };
  return { bottom: pct, top: "auto" };
}

export const Subtitles: React.FC<SubtitlesProps> = ({ config }) => {
  const { fps } = useVideoConfig();
  const blocks = groupCaptionsIntoBlocks(config.captions);

  return (
    <AbsoluteFill>
      <style>{subtitlePackFontFace}</style>
      {blocks.map((block, i) => {
        const startFrame = Math.round((block.startMs / 1000) * fps);
        const durationFrames = Math.max(
          1,
          Math.round(((block.endMs - block.startMs) / 1000) * fps)
        );

        return (
          <Sequence
            key={i}
            from={startFrame}
            durationInFrames={durationFrames}
            layout="none"
          >
            <SubtitleBlock
              block={block}
              config={config}
              blockStartMs={block.startMs}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

interface SubtitleBlockProps {
  block: ReturnType<typeof groupCaptionsIntoBlocks>[number];
  config: SubtitleConfig;
  blockStartMs: number;
}

const SubtitleBlock: React.FC<SubtitleBlockProps> = ({
  block,
  config,
  blockStartMs,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: videoWidth } = useVideoConfig();
  const { style, position } = config;

  // Current time relative to composition start (sequence-relative frame)
  const currentTimeMs = blockStartMs + (frame / fps) * 1000;
  const activeIndex = getActiveWordIndex(block.words, currentTimeMs);

  // Free-drag center point wins over the top/middle/bottom preset — same
  // override rule as HookOverlay's xPct/yPct.
  const free = config.xPct != null && config.yPct != null;
  const positionStyle: React.CSSProperties = free
    ? { left: `${config.xPct! * 100}%`, top: `${config.yPct! * 100}%`, right: "auto", bottom: "auto" }
    : positionStyleFor(position, style.marginV ?? DEFAULT_MARGIN_V);
  const fontStack = getFontStack(style.fontFamily);

  // Block-level pop-in, ~495ms 1%->100% scale (matches the Musa Premiere
  // preset's keyframe timing), Remotion-preview only like Hook's entrance.
  const scaleIn =
    style.animation === "scale-in"
      ? interpolate(frame, [0, Math.round(fps * 0.495)], [0.01, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })
      : 1;

  // Background box style
  const hasBg = style.bgOpacity > 0;
  const bgStyle: React.CSSProperties = hasBg
    ? {
        backgroundColor: `${style.bgColor}${Math.round(style.bgOpacity * 255)
          .toString(16)
          .padStart(2, "0")}`,
        borderRadius: 8,
        padding: "8px 16px",
      }
    : {};

  return (
    <div
      style={{
        position: "absolute",
        ...(free ? {} : { left: 0, right: 0 }),
        display: "flex",
        justifyContent: "center",
        ...(free ? { transform: "translate(-50%, -50%)" } : {}),
        ...positionStyle,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "6px 8px",
          maxWidth: free ? videoWidth * 0.85 : "85%",
          width: free ? "max-content" : undefined,
          transform: scaleIn !== 1 ? `scale(${scaleIn})` : undefined,
          ...bgStyle,
        }}
      >
        {block.words.map((word, i) => (
          <WordSpan
            key={i}
            word={word.text}
            isActive={i === activeIndex}
            style={style}
            fontStack={fontStack}
            animation={style.animation}
            frame={frame}
            fps={fps}
            wordStartMs={word.startMs}
            blockStartMs={blockStartMs}
          />
        ))}
      </div>
    </div>
  );
};

interface WordSpanProps {
  word: string;
  isActive: boolean;
  style: SubtitleConfig["style"];
  fontStack: string;
  animation: SubtitleConfig["style"]["animation"];
  frame: number;
  fps: number;
  wordStartMs: number;
  blockStartMs: number;
}

const WordSpan: React.FC<WordSpanProps> = ({
  word,
  isActive,
  style,
  fontStack,
  animation,
  frame,
  fps,
  wordStartMs,
  blockStartMs,
}) => {
  const wordStartFrame = Math.round(
    ((wordStartMs - blockStartMs) / 1000) * fps
  );

  let transform = "";
  let color = style.fontColor;
  let extraStyle: React.CSSProperties = {};

  // Dim inactive words toward the backend's opaque scaled color (matches the
  // burned ASS look; not CSS opacity).
  if (!isActive && style.baseOpacity != null && style.baseOpacity < 1) {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(style.fontColor || "#FFFFFF");
    if (m) {
      const scale = 0.35 + 0.65 * style.baseOpacity;
      const [r, g, b] = [0, 2, 4].map((i) =>
        Math.round(parseInt(m[1].slice(i, i + 2), 16) * scale)
      );
      color = `rgb(${r}, ${g}, ${b})`;
    }
  }

  if (isActive) {
    color = style.highlightColor;

    switch (animation) {
      case "pop": {
        const scale = spring({
          frame: frame - wordStartFrame,
          fps,
          config: { mass: 0.5, stiffness: 300, damping: 12 },
          durationInFrames: 10,
        });
        const scaleValue = interpolate(scale, [0, 1], [1, 1.25]);
        transform = `scale(${scaleValue})`;
        break;
      }
      case "karaoke": {
        extraStyle = {
          backgroundColor: style.highlightColor,
          color: style.bgColor || "#000000",
          borderRadius: 4,
          padding: "2px 6px",
        };
        break;
      }
      case "word-highlight": {
        extraStyle = {
          textShadow: `0 0 12px ${style.highlightColor}, 0 0 24px ${style.highlightColor}40`,
        };
        break;
      }
      default:
        break;
    }
  }

  // Text stroke via textShadow (CSS paint-order not reliable in Remotion)
  const strokeShadow =
    style.borderWidth > 0
      ? [
          `${style.borderWidth}px 0 0 ${style.borderColor}`,
          `-${style.borderWidth}px 0 0 ${style.borderColor}`,
          `0 ${style.borderWidth}px 0 ${style.borderColor}`,
          `0 -${style.borderWidth}px 0 ${style.borderColor}`,
        ].join(", ")
      : "none";

  return (
    <span
      style={{
        fontFamily: fontStack,
        fontSize: style.fontSize,
        fontWeight: 700,
        color: animation === "karaoke" && isActive ? undefined : color,
        textShadow:
          animation !== "karaoke"
            ? [strokeShadow, extraStyle.textShadow].filter(Boolean).join(", ")
            : strokeShadow,
        transform,
        display: "inline-block",
        transition: "none",
        textTransform: style.uppercase ? "uppercase" : "none",
        ...extraStyle,
      }}
    >
      {word}
    </span>
  );
};
