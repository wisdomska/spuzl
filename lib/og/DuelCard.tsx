import type { ReactNode } from "react";
import { ICONS } from "@/components/ui/icons.generated";
import type { CardFormat } from "@/lib/share/card-model";
import type { DuelShareModel } from "@/lib/share/duel-card";
import { SHARE_DOMAIN } from "@/lib/share/text";
import { Wordmark } from "./ShareCard";
import { SpuzOG } from "./SpuzOG";

/**
 * Duel share card (1080 × 1920 story, 1080 × 1080 square) in the spirit of SPIL's result cards: a loud tilted
 * banner, both players face to face in their own colours, the score, the rounds, one award and a dare to the
 * reader. Satori rules: every box with more than one child is a flex box; icons are inline SVG paths.
 */
const INK = "#0E0F1A";
const PAPER = "#F4F5FB";
const LIME = "#B8F23A";
const GOLD = "#FFC93C";
const DANGER = "#FF5A5F";

/** A Phosphor icon drawn from its path data (the app's own icon set). */
function Glyph({ name, size, color }: { name: string; size: number; color: string }) {
  const src = (ICONS as Record<string, string>)[name] ?? "";
  const paths = [...src.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill={color}>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

const clock = (ms: number | null) => {
  if (ms === null) return "DNF";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** A few pieces of confetti in both players' colours (fixed positions: the card is the same every render). */
function Confetti({ w, h, colors, k }: { w: number; h: number; colors: string[]; k: number }) {
  const bits = [
    [0.08, 0.06, 18, 40],
    [0.9, 0.05, -24, 34],
    [0.16, 0.2, 40, 26],
    [0.84, 0.22, -12, 30],
    [0.05, 0.42, 65, 22],
    [0.95, 0.4, 20, 26],
    [0.12, 0.7, -30, 28],
    [0.9, 0.68, 50, 24],
    [0.5, 0.03, 10, 22],
  ];
  return (
    <>
      {bits.map(([x, y, rot, s], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            display: "flex",
            left: x * w,
            top: y * h,
            width: s * k,
            height: s * k * 0.45,
            borderRadius: 4 * k,
            background: colors[i % colors.length],
            transform: `rotate(${rot}deg)`,
          }}
        />
      ))}
    </>
  );
}

function Player({
  side,
  mood,
  size,
  k,
  crown,
}: {
  side: DuelShareModel["me"];
  mood: "party" | "cheer" | "sad" | "thinking" | "proud";
  size: number;
  k: number;
  crown: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 * k }}>
      <div style={{ display: "flex", position: "relative", width: size, height: size, alignItems: "flex-end", justifyContent: "center" }}>
        <SpuzOG mood={mood} size={size} color={side.color} />
        {crown && (
          <div style={{ position: "absolute", display: "flex", top: -size * 0.14, left: size * 0.33, transform: "rotate(-12deg)" }}>
            <Glyph name="crown" size={size * 0.34} color={GOLD} />
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          maxWidth: size * 1.35,
          padding: `${8 * k}px ${22 * k}px`,
          borderRadius: 999,
          background: side.color,
          color: INK,
          fontFamily: "Unbounded",
          fontWeight: 700,
          fontSize: 30 * k,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {side.name}
      </div>
    </div>
  );
}

export function DuelCardOG({ card, format, scale = 1 }: { card: DuelShareModel; format: CardFormat; scale?: number }) {
  const story = format === "story";
  const W = 1080 * scale;
  const H = (story ? 1920 : 1080) * scale;
  const k = scale * (story ? 1 : 0.78);
  const win = card.outcome === "win";
  const draw = card.outcome === "draw";
  const bannerBg = win ? LIME : draw ? PAPER : card.them.color;
  // The winner cheers under a crown (the party hat would sit under it); the other side looks sorry for itself.
  const myMood = win ? "cheer" : draw ? "thinking" : "sad";
  const theirMood = win ? "sad" : draw ? "thinking" : "cheer";
  const spuz = (story ? 330 : 210) * scale;
  // A walkover at 0-0 has no score or rounds worth showing: the middle just says VS.
  const noScore = card.forfeit && card.me.rounds + card.them.rounds === 0;
  const playedRounds = card.rounds.filter((r) => r.me !== null || r.them !== null);

  const chip = (children: ReactNode, bg: string, fg: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10 * k,
        padding: `${10 * k}px ${24 * k}px`,
        borderRadius: 999,
        background: bg,
        color: fg,
        fontFamily: "Geist",
        fontWeight: 600,
        fontSize: 30 * k,
      }}
    >
      {children}
    </div>
  );

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: W,
        height: H,
        overflow: "hidden",
        background: INK,
        color: PAPER,
        fontFamily: "Geist",
      }}
    >
      {/* Each player's colour glows from their side of the card. */}
      <div
        style={{
          position: "absolute",
          display: "flex",
          left: -W * 0.35,
          top: H * (story ? 0.22 : 0.18),
          width: W * 0.95,
          height: W * 0.95,
          borderRadius: 9999,
          background: `radial-gradient(circle, ${card.me.color}55 0%, ${card.me.color}00 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          display: "flex",
          right: -W * 0.35,
          top: H * (story ? 0.22 : 0.18),
          width: W * 0.95,
          height: W * 0.95,
          borderRadius: 9999,
          background: `radial-gradient(circle, ${card.them.color}55 0%, ${card.them.color}00 70%)`,
        }}
      />
      <Confetti w={W} h={H} k={k} colors={[card.me.color, card.them.color, GOLD, PAPER]} />

      {/* Wordmark and what was played */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * k, marginTop: (story ? 90 : 46) * scale }}>
        <Wordmark c={{ z: LIME }} fs={(story ? 84 : 64) * scale} />
        {chip(
          <>
            <Glyph name="sword" size={30 * k} color={LIME} />
            <span>{`Duel · ${card.gameName}`}</span>
          </>,
          "rgba(255,255,255,.08)",
          PAPER,
        )}
      </div>

      {/* The banner */}
      <div style={{ display: "flex", width: W * 1.1, marginTop: (story ? 56 : 26) * scale, transform: "rotate(-4deg)" }}>
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "center",
            padding: `${(story ? 26 : 18) * scale}px 0`,
            background: bannerBg,
            color: INK,
            fontFamily: "Unbounded",
            fontWeight: 900,
            fontSize: (story ? 118 : 92) * scale,
            letterSpacing: -3 * scale,
            boxShadow: `0 ${14 * k}px 0 rgba(0,0,0,.35)`,
          }}
        >
          {card.banner}
        </div>
      </div>

      {/* Face to face */}
      <div style={{ display: "flex", alignItems: "center", gap: 26 * k, marginTop: (story ? 120 : 30) * scale }}>
        <Player side={card.me} mood={myMood} size={spuz} k={k} crown={win} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 * k, marginTop: -40 * k }}>
          {noScore ? (
            <div
              style={{
                display: "flex",
                fontFamily: "Unbounded",
                fontWeight: 900,
                fontSize: (story ? 110 : 86) * scale,
                color: "rgba(255,255,255,.75)",
              }}
            >
              VS
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 * k }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Unbounded",
                  fontWeight: 900,
                  fontSize: (story ? 150 : 116) * scale,
                  letterSpacing: -6 * scale,
                  lineHeight: 1,
                }}
              >
                <span style={{ color: win ? LIME : PAPER }}>{String(card.me.rounds)}</span>
                <span style={{ color: "rgba(255,255,255,.35)", margin: `0 ${12 * k}px` }}>–</span>
                <span style={{ color: !win && !draw ? card.them.color : PAPER }}>{String(card.them.rounds)}</span>
              </div>
              <div style={{ display: "flex", fontFamily: "Unbounded", fontWeight: 700, fontSize: 30 * k, color: "rgba(255,255,255,.55)" }}>
                VS
              </div>
            </div>
          )}
        </div>
        <Player side={card.them} mood={theirMood} size={spuz} k={k} crown={card.outcome === "loss"} />
      </div>

      {/* Rounds */}
      {story && playedRounds.length > 0 && (
        <div style={{ display: "flex", gap: 16 * k, marginTop: 90 * scale }}>
          {playedRounds.map((r) => (
            <div
              key={r.n}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6 * k,
                width: 250 * k,
                padding: `${16 * k}px 0`,
                borderRadius: 26 * k,
                background: "rgba(255,255,255,.06)",
                border: `${4 * k}px solid ${r.mine === true ? LIME : r.mine === false ? card.them.color : "rgba(255,255,255,.15)"}`,
              }}
            >
              <span style={{ fontSize: 26 * k, color: "rgba(255,255,255,.6)" }}>{`Round ${r.n}`}</span>
              <span style={{ fontFamily: "Geist Mono", fontSize: 40 * k, color: r.mine === true ? LIME : PAPER }}>{clock(r.me)}</span>
              <span style={{ fontFamily: "Geist Mono", fontSize: 26 * k, color: "rgba(255,255,255,.55)" }}>{`vs ${clock(r.them)}`}</span>
            </div>
          ))}
        </div>
      )}

      {/* The award */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 26 * k,
          marginTop: (story ? 90 : 28) * scale,
          padding: `${24 * k}px ${40 * k}px`,
          borderRadius: 36 * k,
          background: GOLD,
          color: INK,
          transform: "rotate(2deg)",
          boxShadow: `0 ${10 * k}px 0 #B8860B`,
        }}
      >
        <Glyph name={card.award.icon} size={72 * k} color={INK} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "Unbounded", fontWeight: 900, fontSize: 46 * k, letterSpacing: -1 * k }}>{card.award.title}</span>
          <span style={{ fontSize: 28 * k, opacity: 0.75 }}>{card.award.sub}</span>
        </div>
      </div>

      {/* Footer: the rating change and the dare */}
      <div
        style={{
          position: "absolute",
          bottom: (story ? 80 : 40) * scale,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14 * k,
        }}
      >
        {card.h2h &&
          chip(
            <>
              <Glyph name="scales" size={30 * k} color={GOLD} />
              <span>{`Head to head ${card.h2h.me}–${card.h2h.them}`}</span>
            </>,
            "rgba(255,255,255,.08)",
            PAPER,
          )}
        {card.ratingDelta !== null &&
          chip(
            <>
              <Glyph name="trophy" size={30 * k} color={card.ratingDelta >= 0 ? LIME : DANGER} />
              <span>{`${card.ratingDelta >= 0 ? "+" : ""}${card.ratingDelta} rating`}</span>
            </>,
            "rgba(255,255,255,.08)",
            PAPER,
          )}
        <div style={{ display: "flex", fontFamily: "Unbounded", fontWeight: 700, fontSize: 34 * k, color: PAPER }}>
          {win ? "Think you can beat me?" : "Your move."}
        </div>
        <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 28 * k, color: LIME }}>{SHARE_DOMAIN}</div>
      </div>
    </div>
  );
}
