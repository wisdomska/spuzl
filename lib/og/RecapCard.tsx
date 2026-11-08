import type { ReactNode } from "react";
import { SHARE_DOMAIN } from "@/lib/share/text";
import { RECAP_CARD_SIZE, type RecapCardModel, type RecapStat } from "@/lib/share/recap-card";
import { Dots, Flame, Wordmark } from "./ShareCard";
import { SpuzOG } from "./SpuzOG";

/**
 * Weekly recap story card for `next/og` (1080 × 1920, R3-10): wordmark, the week, Spuz, the week's clears as the big
 * number, then the stat tiles of the status card. Same dot grid, fonts and ink as the R2-P5 story cards.
 * `scale` shrinks every length for low-data mode.
 */
function Value({ stat, fs }: { stat: RecapStat; fs: number }) {
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

export function RecapCardOG({ card: c, scale: s = 1 }: { card: RecapCardModel; scale?: number }): ReactNode {
  const W = RECAP_CARD_SIZE.width * s;
  const H = RECAP_CARD_SIZE.height * s;
  const valueFs = 44 * s;
  const bigFs = (c.big.length > 3 ? 200 : 260) * s;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: `${110 * s}px ${80 * s}px`,
        background: c.bg,
        color: c.fg,
        position: "relative",
        fontFamily: "Geist",
      }}
    >
      <Dots c={c} s={s} w={W} h={H} />
      <Wordmark c={c} fs={120 * s} />
      <div style={{ position: "relative", display: "flex", marginTop: 36 * s, fontFamily: "Unbounded", fontWeight: 700, fontSize: 52 * s }}>
        {c.kicker}
      </div>
      <div style={{ position: "relative", display: "flex", marginTop: 12 * s, fontWeight: 600, fontSize: 40 * s, opacity: 0.75 }}>
        {c.range}
      </div>
      <div style={{ position: "relative", display: "flex", marginTop: 32 * s }}>
        <SpuzOG mood={c.mood} size={400 * s} color={c.spuz} shadow="rgba(0,0,0,.28)" />
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          marginTop: 24 * s,
          fontFamily: "Unbounded",
          fontWeight: 900,
          fontSize: bigFs,
          lineHeight: 1,
          letterSpacing: -0.04 * bigFs,
        }}
      >
        {c.big}
      </div>
      <div style={{ position: "relative", display: "flex", marginTop: 12 * s, fontWeight: 600, fontSize: 54 * s }}>{c.line}</div>
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
              width: st.id === "best" ? 888 * s : 436 * s,
              margin: 8 * s,
              padding: `${22 * s}px ${28 * s}px`,
              borderRadius: 28 * s,
              background: "rgba(255,255,255,.08)",
              ...(st.id === "best" ? { boxShadow: `inset ${8 * s}px 0 0 ${c.z}` } : {}),
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
          marginTop: 32 * s,
          fontFamily: "Geist Mono",
          fontWeight: 600,
          fontSize: 40 * s,
          opacity: 0.8,
        }}
      >
        {SHARE_DOMAIN}
      </div>
    </div>
  );
}
