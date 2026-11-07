import type { ReactNode } from "react";
import { CHALLENGE_SIZES, type ChallengeCardModel, type ChallengeFormat } from "@/lib/share/challenge-card";
import { Dots, Wordmark } from "./ShareCard";
import { SpuzOG } from "./SpuzOG";

/**
 * Friend challenge frames for `next/og`: the 1200 × 630 link preview of /challenge/<code> and the 1080 × 1920
 * story. Spuz in the sender's colour and equipped hat (the status card's drawing), the game, the time to beat
 * and "Beat me" on a lime pill with the short link. `scale` shrinks every length for low-data mode.
 */
const INK = "#0E0F1A";
const LIME = "#B8F23A";

function Dare({ c, fs }: { c: ChallengeCardModel; fs: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: `${fs * 0.3}px ${fs * 0.7}px`,
        borderRadius: fs,
        background: LIME,
        color: INK,
        fontFamily: "Unbounded",
        fontWeight: 900,
        fontSize: fs,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {c.dare}
    </div>
  );
}

export function ChallengeCardOG({
  card: c,
  format,
  scale: s = 1,
}: {
  card: ChallengeCardModel;
  format: ChallengeFormat;
  scale?: number;
}): ReactNode {
  const { width, height } = CHALLENGE_SIZES[format];
  const W = width * s;
  const H = height * s;
  const shadow = "rgba(0,0,0,.28)";
  if (format === "og") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: `${56 * s}px ${72 * s}px`,
          background: c.bg,
          color: c.fg,
          position: "relative",
        }}
      >
        <Dots c={c} s={s} w={W} h={H} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", width: 640 * s, marginRight: 24 * s }}>
          <Wordmark c={c} fs={64 * s} />
          <div style={{ display: "flex", marginTop: 28 * s, fontFamily: "Unbounded", fontWeight: 700, fontSize: 40 * s, opacity: 0.9 }}>
            {c.kicker}
          </div>
          <div style={{ display: "flex", marginTop: 12 * s, fontFamily: "Geist", fontWeight: 600, fontSize: 32 * s, opacity: 0.75 }}>
            {c.who}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Unbounded",
              fontWeight: 900,
              fontSize: 132 * s,
              lineHeight: 1.05,
              letterSpacing: -0.04 * 132 * s,
            }}
          >
            {c.big}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginTop: 20 * s }}>
            <Dare c={c} fs={44 * s} />
            <div style={{ display: "flex", marginTop: 16 * s, fontFamily: "Geist Mono", fontWeight: 600, fontSize: 26 * s, opacity: 0.8 }}>
              {c.link}
            </div>
          </div>
        </div>
        <div style={{ position: "relative", display: "flex", justifyContent: "center", width: 380 * s }}>
          <SpuzOG mood={c.mood} size={380 * s} color={c.spuz} hat={c.hat} shadow={shadow} />
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
      <div style={{ position: "relative", display: "flex", marginTop: gap, fontFamily: "Unbounded", fontWeight: 700, fontSize: 56 * s }}>
        {c.kicker}
      </div>
      <div style={{ position: "relative", display: "flex", marginTop: gap }}>
        <SpuzOG mood={c.mood} size={560 * s} color={c.spuz} hat={c.hat} shadow={shadow} />
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          marginTop: gap,
          fontFamily: "Geist",
          fontWeight: 600,
          fontSize: 52 * s,
          opacity: 0.8,
        }}
      >
        {c.who}
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          fontFamily: "Unbounded",
          fontWeight: 900,
          fontSize: 220 * s,
          lineHeight: 1.05,
          letterSpacing: -0.04 * 220 * s,
        }}
      >
        {c.big}
      </div>
      <div style={{ position: "relative", display: "flex", marginTop: "auto" }}>
        <Dare c={c} fs={88 * s} />
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          marginTop: gap,
          fontFamily: "Geist Mono",
          fontWeight: 600,
          fontSize: 44 * s,
          opacity: 0.85,
        }}
      >
        {c.link}
      </div>
    </div>
  );
}
