"use client";

import type { CSSProperties, ReactNode } from "react";
import { Spuz, type SpuzMood } from "@/components/brand/Spuz";

/**
 * Spuz wearing Shop cosmetics: skin colour plus a hat drawn over the head (Spuz itself only draws the
 * party hat in its party mood). Units are Spuz em (size / 12) so hats scale with any avatar size. The hat
 * rides inside Spuz's body layer, so it hops, breathes and tilts with the mood and stays put when motion is
 * reduced or the Spuz is still. The box is always size × size: wearing a hat never shifts layout.
 */
export type HatId = "party" | "crown" | "kente" | "shades" | "headphones" | "chef" | "beanie" | string;

const HATS = new Set(["party", "crown", "kente", "shades", "headphones", "chef", "beanie"]);

/** Below this size (avatar chips, 24 to 40 px) hats drop their finest details and keep thin lines at 1 px. */
export const TINY_SPUZ = 48;

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
  /** an accessible name; without one the Spuz is decorative */
  label?: string;
}) {
  // Party mood brings its own party hat; swap to cheer so hats never stack.
  const m: SpuzMood = hat && mood === "party" ? "cheer" : mood;
  return (
    <div
      className={`relative shrink-0 ${hat ? "spuz-no-tuft" : ""} ${className ?? ""}`}
      style={{ width: size, height: size, ...style }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Spuz mood={m} size={size} color={color} still={still} decorative wear={hat ? <Hat id={hat} size={size} /> : undefined} />
    </div>
  );
}

/** The hat layer: a 12 em box over Spuz, tagged with the hat id (`data-hat`) for tests. */
function Hat({ id, size }: { id: HatId; size: number }) {
  const known = HATS.has(id) ? id : "party";
  return (
    <div aria-hidden data-hat={known} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {hatShape(known, size)}
    </div>
  );
}

function hatShape(id: HatId, size: number): ReactNode {
  const em = size / 12;
  const tiny = size < TINY_SPUZ;
  /** a thin line: never under 1 px, so it still reads on a small chip */
  const line = (n: number) => Math.max(1, n * em);
  const box: CSSProperties = { position: "absolute", pointerEvents: "none" };
  if (id === "crown")
    return (
      <div style={{ ...box, left: 4.4 * em, top: 1.15 * em, width: 3.2 * em, height: 2.2 * em, transform: "rotate(-6deg)" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: "polygon(0 100%,0 25%,22% 60%,50% 0,78% 60%,100% 25%,100% 100%)",
            background: "#FFC93C",
            boxShadow: tiny ? undefined : "inset 0 -0.4em 0 rgba(0,0,0,.18)",
          }}
        />
        {!tiny && (
          <div
            style={{
              position: "absolute",
              left: "44%",
              top: "55%",
              width: 0.45 * em,
              height: 0.45 * em,
              borderRadius: "50%",
              background: "#FF5A5F",
            }}
          />
        )}
      </div>
    );
  if (id === "kente")
    return (
      <div style={{ ...box, left: 3.4 * em, top: 1.4 * em, width: 5.2 * em, height: 2.4 * em, transform: "rotate(-5deg)" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: `${2.6 * em}px ${2.6 * em}px ${0.4 * em}px ${0.4 * em}px`,
            // Tiny: fewer, wider stripes so the cap reads as kente, not as a brown smudge.
            background: tiny
              ? "repeating-linear-gradient(90deg,#FFC93C 0 1em,#167A45 1em 2em,#C62828 2em 2.5em)"
              : "repeating-linear-gradient(90deg,#FFC93C 0 .5em,#167A45 .5em 1em,#C62828 1em 1.25em,#0E0F1A 1.25em 1.5em)",
            fontSize: em,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -0.2 * em,
            right: -0.2 * em,
            bottom: -0.3 * em,
            height: line(0.6),
            borderRadius: 0.3 * em,
            background: "#FFC93C",
          }}
        />
      </div>
    );
  // Starter hat: a lime beanie with a ribbed band and a two-leaf sprout on top.
  if (id === "beanie")
    return (
      <div style={{ ...box, left: 3.1 * em, top: 0.5 * em, width: 5.8 * em, height: 3.3 * em, transform: "rotate(-6deg)" }}>
        <div
          style={{
            position: "absolute",
            left: 2.55 * em,
            top: 0,
            width: line(0.3),
            height: 0.9 * em,
            borderRadius: 0.15 * em,
            background: "#167A45",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 1.75 * em,
            top: 0.05 * em,
            width: 0.95 * em,
            height: 0.55 * em,
            borderRadius: "100% 0",
            background: "#167A45",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 2.75 * em,
            top: -0.1 * em,
            width: 1.05 * em,
            height: 0.6 * em,
            borderRadius: "0 100%",
            background: "#167A45",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0.2 * em,
            right: 0.2 * em,
            top: 0.75 * em,
            bottom: 0.6 * em,
            borderRadius: `${2.7 * em}px ${2.7 * em}px 0 0`,
            background: "#B8F23A",
            boxShadow: `inset ${-0.35 * em}px ${-0.2 * em}px 0 rgba(0,0,0,.14)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 0.95 * em,
            borderRadius: 0.4 * em,
            // Tiny: a solid dark band (the 1 px ribs would blur into the lime).
            background: tiny ? "#167A45" : "repeating-linear-gradient(90deg,#B8F23A 0 .35em,#167A45 .35em .5em)",
            fontSize: em,
          }}
        />
      </div>
    );
  // Spuz geometry in em (root box): body x 1.5..10.5 from y 3.05; left eye x 3.2..5.6, y 4.7..7.3;
  // right eye x 6.65..8.25, y 5.3..7.05; side ear x 9.5..11.6, y 5.65..7.75.
  if (id === "shades") {
    const lens = (l: number, t: number, w: number, h: number): CSSProperties => ({
      position: "absolute",
      left: l * em,
      top: t * em,
      width: w * em,
      height: h * em,
      borderRadius: `${0.45 * em}px ${0.45 * em}px ${1 * em}px ${1 * em}px`,
      background: tiny ? "#0E0F1A" : "linear-gradient(160deg,#2B2F4A 0 30%,#0E0F1A 30%)",
      boxShadow: tiny ? undefined : `inset 0 0 0 ${0.16 * em}px #0E0F1A`,
    });
    return (
      <div style={{ ...box, inset: 0, transform: "rotate(-3deg)", transformOrigin: "50% 50%" }}>
        <div
          style={{
            position: "absolute",
            left: 1.75 * em,
            top: 5.05 * em,
            width: 7.9 * em,
            height: line(0.32),
            borderRadius: 0.16 * em,
            background: "#0E0F1A",
          }}
        />
        {/* Each lens covers its eye with room to spare, rounded corners included (the eyes are at 3.2 to 5.6 × 4.7 to
            7.3 em and 6.65 to 8.25 × 5.3 to 7.05 em), so no eye peeks out at any size. */}
        <div style={lens(2.6, 4.4, 3.55, 3.3)} />
        <div style={lens(6.2, 4.6, 2.75, 2.95)} />
        <div
          style={{
            position: "absolute",
            left: 3.3 * em,
            top: 4.95 * em,
            width: 0.9 * em,
            height: line(0.22),
            borderRadius: 0.11 * em,
            background: "#2FD3E0",
            opacity: 0.8,
          }}
        />
      </div>
    );
  }
  if (id === "headphones") {
    const cup = (l: number): CSSProperties => ({
      position: "absolute",
      left: l * em,
      top: 5.0 * em,
      width: 1.55 * em,
      height: 2.6 * em,
      borderRadius: 0.75 * em,
      background: "#8B7CFF",
      boxShadow: tiny ? `0 0 0 1px #0E0F1A` : `inset ${-0.25 * em}px ${-0.3 * em}px 0 rgba(0,0,0,.22), 0 0 0 ${0.14 * em}px #0E0F1A`,
    });
    return (
      <div style={{ ...box, inset: 0 }}>
        <div
          style={{
            position: "absolute",
            left: 1.25 * em,
            top: 1.75 * em,
            width: 9.6 * em,
            height: 5.2 * em,
            border: `${line(0.55)}px solid #5B4BD6`,
            borderBottom: "none",
            borderRadius: `${4.8 * em}px ${4.8 * em}px 0 0`,
            boxSizing: "border-box",
          }}
        />
        <div style={cup(0.7)} />
        <div style={cup(9.85)} />
        {!tiny && (
          <div
            style={{
              position: "absolute",
              left: 10.15 * em,
              top: 5.55 * em,
              width: 0.5 * em,
              height: 0.5 * em,
              borderRadius: "50%",
              background: "#B8F23A",
            }}
          />
        )}
      </div>
    );
  }
  if (id === "chef") {
    const puff = (l: number, t: number, s: number): CSSProperties => ({
      position: "absolute",
      left: l * em,
      top: t * em,
      width: s * em,
      height: s * em,
      borderRadius: "50%",
      background: "#F4F5FB",
      boxShadow: `inset ${-0.25 * em}px ${-0.25 * em}px 0 rgba(14,15,26,.10)`,
    });
    return (
      <div style={{ ...box, inset: 0, transform: "rotate(-5deg)", transformOrigin: "50% 30%" }}>
        <div style={puff(3.2, 0.75, 2.4)} />
        <div style={puff(6.1, 0.75, 2.4)} />
        <div style={puff(4.45, -0.05, 2.9)} />
        <div
          style={{
            position: "absolute",
            left: 3.75 * em,
            top: 1.9 * em,
            width: 4.3 * em,
            height: 1.55 * em,
            background: "#F4F5FB",
            borderRadius: `0 0 ${0.3 * em}px ${0.3 * em}px`,
            boxShadow: `inset 0 ${-0.3 * em}px 0 rgba(14,15,26,.10)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 3.6 * em,
            top: 3.0 * em,
            width: 4.6 * em,
            height: line(0.55),
            background: "#D9DCEB",
            borderRadius: 0.27 * em,
          }}
        />
      </div>
    );
  }
  // party (default)
  return (
    <div
      style={{
        ...box,
        left: 4.6 * em,
        top: 0.1 * em,
        width: 2.8 * em,
        height: 3.2 * em,
        transform: "rotate(-12deg)",
        transformOrigin: "50% 100%",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: "polygon(50% 0,100% 100%,0 100%)",
          background: tiny
            ? "repeating-linear-gradient(135deg,#FFC93C 0 .9em,#FF5A5F .9em 1.8em)"
            : "repeating-linear-gradient(135deg,#FFC93C 0 .45em,#FF5A5F .45em .9em)",
          fontSize: em,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0.95 * em,
          top: -0.5 * em,
          width: 0.9 * em,
          height: 0.9 * em,
          borderRadius: "50%",
          background: "#F4F5FB",
        }}
      />
    </div>
  );
}
