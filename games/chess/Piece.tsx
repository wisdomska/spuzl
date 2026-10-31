"use client";

import { useEffect, useState, type CSSProperties } from "react";

/** Prototype CH_G glyphs (text presentation) and the W3D / B3D gradient styling. */
export const CH_G: Record<string, string> = { K: "♚︎", Q: "♛︎", R: "♜︎", B: "♝︎", N: "♞︎", P: "♟︎" };
export const CH_N: Record<string, string> = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn" };
export const W3D = {
  pbg: "linear-gradient(180deg,#FFFFFF 0%,#F4EEF7 42%,#C3B6D2 100%)",
  pf: "drop-shadow(0 -1px 0 rgba(255,255,255,.9)) drop-shadow(0 1px 0 #9C8FB0) drop-shadow(0 1px 0 #7F7296) drop-shadow(0 1px 0 #5F5377) drop-shadow(0 3px 2px rgba(14,15,26,.55))",
};
export const B3D = {
  pbg: "linear-gradient(180deg,#7A7398 0%,#36304F 38%,#0E0F1A 100%)",
  pf: "drop-shadow(0 -1px 0 rgba(255,255,255,.35)) drop-shadow(0 1px 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 3px 2px rgba(0,0,0,.6))",
};

const KEYS = ["K", "Q", "R", "B", "N", "P"].flatMap((t) => ["w" + t, "b" + t]);
const spriteUrl = (key: string) => `/3d/pieces/${key}.webp`;
let probe: Promise<Set<string>> | null = null;

/** Pre-rendered 3D sprites (scripts/prerender-3d.mjs). Resolves the set of sprites that loaded; missing ones fall back to glyphs. */
function loadSprites(): Promise<Set<string>> {
  return (probe ??= Promise.all(
    KEYS.map(
      (k) =>
        new Promise<string | null>((res) => {
          const img = new Image();
          img.onload = () => res(k);
          img.onerror = () => res(null);
          img.src = spriteUrl(k);
        }),
    ),
  ).then((ok) => new Set(ok.filter((k): k is string => !!k))));
}

export function useSprites(): Set<string> | null {
  const [set, setSet] = useState<Set<string> | null>(null);
  useEffect(() => {
    let live = true;
    void loadSprites().then((s) => live && setSet(s));
    return () => {
      live = false;
    };
  }, []);
  return set;
}

/**
 * One chess piece standing on its square: the 3D sprite (190% of the square, bottom aligned, like the
 * design), or the CSS-gradient glyph with a contact shadow when the sprite is missing.
 */
export function Piece({
  ch,
  size,
  sprites,
  lift,
  className,
  style,
}: {
  ch: string;
  size: number;
  sprites: Set<string> | null;
  lift?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const white = ch === ch.toUpperCase();
  const key = (white ? "w" : "b") + ch.toUpperCase();
  const motion: CSSProperties = {
    transform: lift ? "translateY(-8px) scale(1.1)" : "none",
    transformOrigin: "50% 100%",
    transition: "transform 180ms cubic-bezier(.34,1.56,.64,1)",
  };
  if (sprites?.has(key)) {
    return (
      <span
        aria-hidden
        className={`pointer-events-none absolute ${className ?? ""}`}
        style={{ left: "-45%", bottom: 0, width: "190%", height: "190%", zIndex: 1, ...motion, ...style }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={spriteUrl(key)} alt="" draggable={false} className="h-full w-full object-contain object-bottom" />
      </span>
    );
  }
  const look = white ? W3D : B3D;
  return (
    <>
      <span
        aria-hidden
        className="absolute rounded-full"
        style={{
          left: "20%",
          right: "20%",
          bottom: "7%",
          height: "16%",
          background: "radial-gradient(closest-side,rgba(14,15,26,.6),transparent)",
        }}
      />
      <span
        aria-hidden
        className={`relative ${className ?? ""}`}
        style={{
          fontFamily: "'Segoe UI Symbol','Noto Sans Symbols 2','DejaVu Sans',serif",
          fontSize: Math.round(size * 0.82),
          lineHeight: 1,
          color: "transparent",
          background: look.pbg,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          filter: look.pf,
          zIndex: 1,
          ...motion,
          transform: `${lift ? "translateY(-10px) scale(1.1)" : "translateY(-2px)"}`,
          ...style,
        }}
      >
        {CH_G[ch.toUpperCase()]}
      </span>
    </>
  );
}
