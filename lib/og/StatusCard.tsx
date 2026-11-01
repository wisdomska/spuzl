import type { ReactNode } from "react";
import { STATUS_CARD_SIZE, type StatusCardModel, type StatusStat } from "@/lib/share/card-model";
import { Dots, Flame, Wordmark } from "./ShareCard";
import { SpuzOG } from "./SpuzOG";

/**
 * Status card frame for `next/og` (1080 × 1350): wordmark, Spuz in the player's colour and hat, nickname,
 * rank emblem, and a 2 × 2 grid of stats. Same dot grid, fonts and ink as the other share cards.
 * `scale` shrinks every length for low-data mode.
 */
const HEX_CLIP = "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)";

function Value({ stat, fs }: { stat: StatusStat; fs: number }) {
  if (!stat.value.startsWith("🔥")) return <span>{stat.value}</span>;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", marginRight: fs * 0.3, marginTop: -fs * 0.08 }}>
        <Flame size={fs * 0.95} />
      </div>
      <span>{stat.value.replace("🔥", "").trim()}</span>
    </div>
  );
}

export function StatusCard({ card: c, scale: s = 1 }: { card: StatusCardModel; scale?: number }): ReactNode {
  const W = STATUS_CARD_SIZE.width * s;
  const H = STATUS_CARD_SIZE.height * s;
  // Nicknames run to 16 characters; Unbounded Black's widest glyph (W) is about 1.12 em, so size to fit 900 px.
  const nickFs = Math.min(96, Math.floor(900 / (Math.max(1, c.nickname.length) * 1.12))) * s;
  const valueFs = 46 * s;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: `${80 * s}px ${80 * s}px`,
        background: c.bg,
        color: c.fg,
        position: "relative",
        fontFamily: "Geist",
      }}
    >
      <Dots c={c} s={s} w={W} h={H} />
      <div style={{ position: "relative", display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark c={c} fs={84 * s} />
        <div style={{ display: "flex", fontFamily: "Unbounded", fontWeight: 700, fontSize: 36 * s, opacity: 0.85 }}>{c.kicker}</div>
      </div>
      <div style={{ position: "relative", display: "flex", marginTop: 36 * s }}>
        <SpuzOG mood={c.mood} size={440 * s} color={c.spuz} hat={c.hat} shadow="rgba(0,0,0,.28)" />
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          marginTop: 16 * s,
          fontFamily: "Unbounded",
          fontWeight: 900,
          fontSize: nickFs,
          lineHeight: 1,
          letterSpacing: -0.03 * nickFs,
        }}
      >
        {c.nickname}
      </div>
      {c.rank && (
        <div style={{ position: "relative", display: "flex", alignItems: "center", marginTop: 28 * s }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64 * s,
              height: 72 * s,
              clipPath: HEX_CLIP,
              background: c.rank.color,
            }}
          >
            <div style={{ display: "flex", width: 30 * s, height: 34 * s, clipPath: HEX_CLIP, background: "rgba(14,15,26,.35)" }} />
          </div>
          <div style={{ display: "flex", marginLeft: 20 * s, fontFamily: "Unbounded", fontWeight: 700, fontSize: 44 * s }}>
            {c.rank.label}
          </div>
        </div>
      )}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          width: "100%",
          marginTop: "auto",
        }}
      >
        {c.stats.map((st) => (
          <div
            key={st.id}
            style={{
              display: "flex",
              flexDirection: "column",
              width: 436 * s,
              margin: 8 * s,
              padding: `${22 * s}px ${28 * s}px`,
              borderRadius: 28 * s,
              background: "rgba(255,255,255,.08)",
              // Satori rejects undefined CSS values, so the world stripe is spread in only when shown.
              ...(st.id === "world" && c.worldHex ? { boxShadow: `inset ${8 * s}px 0 0 ${c.worldHex}` } : {}),
            }}
          >
            <div style={{ display: "flex", fontWeight: 600, fontSize: 28 * s, opacity: 0.72 }}>{st.label}</div>
            <div style={{ display: "flex", marginTop: 6 * s, fontFamily: "Unbounded", fontWeight: 700, fontSize: valueFs }}>
              <Value stat={st} fs={valueFs} />
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          marginTop: 28 * s,
          fontFamily: "Geist Mono",
          fontWeight: 600,
          fontSize: 36 * s,
          opacity: 0.8,
        }}
      >
        spuzl.gg
      </div>
    </div>
  );
}
