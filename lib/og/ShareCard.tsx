import type { ReactNode } from "react";
import type { CardFormat, CardModel } from "@/lib/share/card-model";
import { SpuzOG } from "./SpuzOG";

/**
 * Share card frames for `next/og`, ported from the design's "Share cards" section
 * (1080 × 1920 story and 1080 × 1080 square). `scale` shrinks every length for low-data mode.
 */

/** 🔥 (Twemoji 1f525, CC-BY 4.0) as inline SVG, so cards render without fetching an emoji CDN. */
function Flame({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <path
        fill="#F4900C"
        d="M35 19c0-2.062-.367-4.039-1.04-5.868-.46 5.389-3.333 8.157-6.335 6.868-2.812-1.208-.917-5.917-.777-8.164.236-3.809-.012-8.169-6.931-11.794 2.875 5.5.333 8.917-2.333 9.125-2.958.231-5.667-2.542-4.667-7.042-3.238 2.386-3.332 6.402-2.333 9 1.042 2.708-.042 4.958-2.583 5.208-2.84.28-4.418-3.041-2.963-8.333C2.52 10.965 1 14.805 1 19c0 9.389 7.611 17 17 17s17-7.611 17-17z"
      />
      <path
        fill="#FFCC4D"
        d="M28.394 23.999c.148 3.084-2.561 4.293-4.019 3.709-2.106-.843-1.541-2.291-2.083-5.291s-2.625-5.083-5.708-6c2.25 6.333-1.247 8.667-3.08 9.084-1.872.426-3.753-.001-3.968-4.007C7.352 23.668 6 26.676 6 30c0 .368.023.73.055 1.09C9.125 34.124 13.342 36 18 36s8.875-1.876 11.945-4.91c.032-.36.055-.722.055-1.09 0-2.187-.584-4.236-1.606-6.001z"
      />
    </svg>
  );
}

function Foot({ text, size }: { text: string; size: number }) {
  if (!text.includes("🔥")) return <span>{text}</span>;
  const [before, after] = text.split("🔥");
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {before ? <span>{before}</span> : null}
      <div style={{ display: "flex", marginRight: size * 0.4, marginTop: -size * 0.08 }}>
        <Flame size={size * 0.95} />
      </div>
      <span>{after.trim()}</span>
    </div>
  );
}

function Wordmark({ c, fs }: { c: CardModel; fs: number }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        fontFamily: "Unbounded",
        fontWeight: 900,
        fontSize: fs,
        lineHeight: 0.9,
        letterSpacing: -0.05 * fs,
      }}
    >
      <span>SPU</span>
      <span style={{ color: c.z }}>Z</span>
      <span>L</span>
    </div>
  );
}

/** The design's dot grid (5 px dots every 64 px) as an SVG pattern: Satori drops px-stop radial gradients. */
function Dots({ c, s, w, h }: { c: CardModel; s: number; w: number; h: number }) {
  const step = 64 * s;
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <pattern id="dots" width={step} height={step} patternUnits="userSpaceOnUse">
          <circle cx={step / 2} cy={step / 2} r={5 * s} fill={c.dot} />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#dots)" />
    </svg>
  );
}

export function ShareCard({ card: c, format, scale: s = 1 }: { card: CardModel; format: CardFormat; scale?: number }): ReactNode {
  const shadow = c.fg === "#0E0F1A" ? "rgba(14,15,26,.22)" : "rgba(0,0,0,.28)";
  const W = 1080 * s;
  const H = (format === "square" ? 1080 : 1920) * s;
  if (format === "square") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: 90 * s,
          background: c.bg,
          color: c.fg,
          position: "relative",
        }}
      >
        <Dots c={c} s={s} w={W} h={H} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", width: 435 * s, marginRight: 30 * s }}>
          <Wordmark c={c} fs={90 * s} />
          <div style={{ display: "flex", marginTop: 30 * s, fontFamily: "Unbounded", fontWeight: 700, fontSize: 44 * s, opacity: 0.85 }}>
            {c.kicker}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 30 * s,
              fontFamily: "Unbounded",
              fontWeight: 900,
              fontSize: c.sqFs * s,
              lineHeight: 1,
              letterSpacing: -0.04 * c.sqFs * s,
            }}
          >
            {c.big}
          </div>
          <div style={{ display: "flex", marginTop: 30 * s, fontFamily: "Geist", fontWeight: 600, fontSize: 42 * s, lineHeight: 1.3 }}>
            {c.line}
          </div>
          <div style={{ display: "flex", marginTop: 30 * s, fontFamily: "Geist Mono", fontWeight: 600, fontSize: 36 * s, opacity: 0.8 }}>
            spuzl.gg
          </div>
        </div>
        <div style={{ position: "relative", display: "flex", justifyContent: "center", width: 435 * s }}>
          <SpuzOG mood={c.mood} size={440 * s} color={c.spuz} shadow={shadow} />
        </div>
      </div>
    );
  }
  const gap = 40 * s;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: `${120 * s}px ${90 * s}px`,
        background: c.bg,
        color: c.fg,
        position: "relative",
      }}
    >
      <Dots c={c} s={s} w={W} h={H} />
      <Wordmark c={c} fs={120 * s} />
      <div
        style={{
          position: "relative",
          display: "flex",
          marginTop: gap,
          fontFamily: "Unbounded",
          fontWeight: 700,
          fontSize: 52 * s,
          opacity: 0.85,
        }}
      >
        {c.kicker}
      </div>
      <div style={{ position: "relative", display: "flex", marginTop: gap }}>
        <SpuzOG mood={c.mood} size={560 * s} color={c.spuz} shadow={shadow} />
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          marginTop: gap,
          fontFamily: "Unbounded",
          fontWeight: 900,
          fontSize: c.bigFs * s,
          lineHeight: 1,
          letterSpacing: -0.04 * c.bigFs * s,
          textAlign: "center",
        }}
      >
        {c.big}
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          marginTop: gap,
          fontFamily: "Geist",
          fontWeight: 600,
          fontSize: 54 * s,
          lineHeight: 1.3,
          textAlign: "center",
          justifyContent: "center",
        }}
      >
        {c.line}
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          marginTop: "auto",
          fontFamily: "Geist Mono",
          fontWeight: 600,
          fontSize: 48 * s,
        }}
      >
        <Foot text={c.foot} size={48 * s} />
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          marginTop: gap,
          fontFamily: "Geist Mono",
          fontWeight: 600,
          fontSize: 40 * s,
          opacity: 0.8,
        }}
      >
        spuzl.gg
      </div>
    </div>
  );
}
