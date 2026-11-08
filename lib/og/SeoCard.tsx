import type { ReactElement, ReactNode } from "react";
import { ImageResponse } from "next/og";
import { ICONS } from "@/components/ui/icons.generated";
import { WORLD_BY_ID, type GameMeta } from "@/lib/catalog";
import { WORLD_HEX, mix } from "@/lib/share/card-model";
import { ogFonts } from "./fonts";
import { Wordmark } from "./ShareCard";
import { SpuzOG } from "./SpuzOG";

/**
 * Link previews for the public pages (1200 × 630): the site card (app/opengraph-image.tsx) and one card per game
 * (app/games/[id]/opengraph-image.tsx). Brand tokens as hex (OG images cannot read CSS variables): ink background,
 * lime for the interface, the world's own colour for the game's tile.
 */
export const SEO_CARD_SIZE = { width: 1200, height: 630 };
const INK = "#0E0F1A";
const PAPER = "#F4F5FB";
const MUTED = "#A2A6C2";
const LIME = "#B8F23A";

/** A Phosphor icon as an <img> (Satori draws SVG data URLs, not inner markup). */
function IconImg({ name, size, color }: { name: string; size: number; color: string }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="${color}">${ICONS[name] ?? ICONS["question"]}</svg>`;
  // eslint-disable-next-line @next/next/no-img-element -- Satori (next/og) renders plain <img> only
  return <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} width={size} height={size} alt="" />;
}

function Frame({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 72px",
        background: bg,
        color: PAPER,
        fontFamily: "Geist",
      }}
    >
      {children}
    </div>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "14px 30px",
        borderRadius: 40,
        background: LIME,
        color: INK,
        fontFamily: "Unbounded",
        fontWeight: 900,
        fontSize: 30,
      }}
    >
      {text}
    </div>
  );
}

export function GameSeoCard({ game: g, label }: { game: GameMeta; label: { play: string; free: string } }): ReactElement {
  const world = WORLD_BY_ID[g.world];
  const hex = WORLD_HEX[g.world];
  return (
    <Frame bg={mix(INK, hex, 0.12)}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark c={{ z: LIME }} fs={44} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 28, fontWeight: 600, color: hex }}>
          <IconImg name={world.icon} size={32} color={hex} />
          {world.name}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 220,
            height: 220,
            borderRadius: 64,
            background: hex,
            boxShadow: "inset -10px -10px 0 rgba(0,0,0,.18), inset 8px 8px 0 rgba(255,255,255,.22)",
          }}
        >
          <IconImg name={g.icon} size={120} color={INK} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          <div style={{ display: "flex", fontFamily: "Unbounded", fontWeight: 900, fontSize: 84, lineHeight: 1, letterSpacing: -3 }}>
            {g.name}
          </div>
          <div style={{ display: "flex", fontSize: 32, lineHeight: 1.3, color: MUTED }}>{g.rule}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Pill text={label.play} />
        <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 26, fontWeight: 600, color: MUTED }}>{label.free}</div>
      </div>
    </Frame>
  );
}

export function SiteSeoCard({ title, line, foot }: { title: string; line: string; foot: string }): ReactElement {
  return (
    <Frame bg={INK}>
      <Wordmark c={{ z: LIME }} fs={52} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
          <div style={{ display: "flex", fontFamily: "Unbounded", fontWeight: 900, fontSize: 76, lineHeight: 1.02, letterSpacing: -3 }}>
            {title}
          </div>
          <div style={{ display: "flex", fontSize: 32, lineHeight: 1.3, color: MUTED }}>{line}</div>
        </div>
        <SpuzOG mood="wave" size={230} color={LIME} />
      </div>
      <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 26, fontWeight: 600, color: LIME }}>{foot}</div>
    </Frame>
  );
}

const HEADERS = { "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" };

export async function renderSeoCard(node: ReactElement): Promise<ImageResponse> {
  return new ImageResponse(node, { ...SEO_CARD_SIZE, fonts: await ogFonts(), headers: HEADERS });
}
