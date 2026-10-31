"use client";

import type { CSSProperties } from "react";
import { Spuz, type SpuzMood } from "@/components/brand/Spuz";

/**
 * Spuz wearing Shop cosmetics: skin colour plus a hat drawn over the head (Spuz itself only draws the
 * party hat in its party mood). Units are Spuz em (size / 12) so hats scale with any avatar size.
 */
export type HatId = "party" | "crown" | "kente" | string;

export function SpuzWear({
  size,
  color,
  hat,
  mood = "idle",
  still,
  className,
  style,
  label,
}: {
  size: number;
  color: string;
  hat?: HatId | null;
  mood?: SpuzMood;
  still?: boolean;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  // Party mood brings its own party hat; swap to cheer so hats never stack.
  const m: SpuzMood = hat && mood === "party" ? "cheer" : mood;
  return (
    <div
      className={`relative shrink-0 ${className ?? ""}`}
      style={{ width: size, height: size, ...style }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <Spuz mood={m} size={size} color={color} still={still} decorative />
      {hat && <Hat id={hat} size={size} />}
    </div>
  );
}

function Hat({ id, size }: { id: HatId; size: number }) {
  const em = size / 12;
  const box: CSSProperties = { position: "absolute", pointerEvents: "none" };
  if (id === "crown")
    return (
      <div aria-hidden style={{ ...box, left: 4.4 * em, top: 1.15 * em, width: 3.2 * em, height: 2.2 * em, transform: "rotate(-6deg)" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: "polygon(0 100%,0 25%,22% 60%,50% 0,78% 60%,100% 25%,100% 100%)",
            background: "#FFC93C",
            boxShadow: "inset 0 -0.4em 0 rgba(0,0,0,.18)",
          }}
        />
        <div style={{ position: "absolute", left: "44%", top: "55%", width: 0.45 * em, height: 0.45 * em, borderRadius: "50%", background: "#FF5A5F" }} />
      </div>
    );
  if (id === "kente")
    return (
      <div aria-hidden style={{ ...box, left: 3.4 * em, top: 1.4 * em, width: 5.2 * em, height: 2.4 * em, transform: "rotate(-5deg)" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: `${2.6 * em}px ${2.6 * em}px ${0.4 * em}px ${0.4 * em}px`,
            background: "repeating-linear-gradient(90deg,#FFC93C 0 .5em,#167A45 .5em 1em,#C62828 1em 1.25em,#0E0F1A 1.25em 1.5em)",
            fontSize: em,
          }}
        />
        <div style={{ position: "absolute", left: -0.2 * em, right: -0.2 * em, bottom: -0.3 * em, height: 0.6 * em, borderRadius: 0.3 * em, background: "#FFC93C" }} />
      </div>
    );
  // party (default)
  return (
    <div aria-hidden style={{ ...box, left: 4.6 * em, top: 0.1 * em, width: 2.8 * em, height: 3.2 * em, transform: "rotate(-12deg)", transformOrigin: "50% 100%" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: "polygon(50% 0,100% 100%,0 100%)",
          background: "repeating-linear-gradient(135deg,#FFC93C 0 .45em,#FF5A5F .45em .9em)",
          fontSize: em,
        }}
      />
      <div style={{ position: "absolute", left: 0.95 * em, top: -0.5 * em, width: 0.9 * em, height: 0.9 * em, borderRadius: "50%", background: "#F4F5FB" }} />
    </div>
  );
}
