import React from "react";
import { AbsoluteFill } from "remotion";
import type { LogoConfig } from "../lib/types";

interface LogoOverlayProps {
  config: LogoConfig | null;
}

// Percentages keep the logo safely inset from social-media chrome (TikTok/IG UI).
const POSITION_STYLE: Record<string, React.CSSProperties> = {
  "top-left":    { top: "8%",  left: "3%",   bottom: "auto", right: "auto", transform: "none" },
  "top-right":   { top: "8%",  right: "3%", bottom: "auto", left: "auto", transform: "none" },
  "bottom-left": { bottom: "12%", left: "3%", top: "auto",  right: "auto", transform: "none" },
  "bottom-right":{ bottom: "12%", right: "3%", top: "auto",  left: "auto", transform: "none" },
};

export const LogoOverlay: React.FC<LogoOverlayProps> = ({ config }) => {
  if (!config) return null;

  const positionStyle = POSITION_STYLE[config.position] ?? POSITION_STYLE["bottom-right"];
  const scaledWidth = Math.round(config.scale * 120); // px at 1080w base → scales naturally
  const scaledHeight = Math.round(scaledWidth * (1 / (800 / 600))); // approximate aspect ratio

  return (
    <AbsoluteFill>
      <img
        src={config.url}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          width: scaledWidth,
          height: "auto",
          opacity: config.opacity,
          pointerEvents: "none",
          ...positionStyle,
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      />
    </AbsoluteFill>
  );
};
