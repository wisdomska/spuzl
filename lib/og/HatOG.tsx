import type { CSSProperties, ReactNode } from "react";

/**
 * Shop hats for `next/og` (Satori): the hats of components/meta/SpuzWear.tsx, drawn over SpuzOG's root box.
 * Same geometry in Spuz em (size / 12), converted to px because Satori has no `inset`, no `em` in gradients and
 * needs `display: flex` on every div. Keep the two in sync when a hat changes. Unknown ids draw the party hat,
 * as SpuzWear does.
 */
export function HatOG({ id, size }: { id: string; size: number }) {
  const em = size / 12;
  const abs = (l: number, t: number, w: number, h: number, st: CSSProperties = {}, kids?: ReactNode) => (
    <div style={{ position: "absolute", display: "flex", left: l * em, top: t * em, width: w * em, height: h * em, ...st }}>{kids}</div>
  );
  const full = (st: CSSProperties = {}, kids?: ReactNode) => abs(0, 0, 12, 12, st, kids);

  if (id === "crown")
    return abs(
      4.4,
      1.15,
      3.2,
      2.2,
      { transform: "rotate(-6deg)" },
      <>
        {abs(0, 0, 3.2, 2.2, {
          clipPath: "polygon(0 100%,0 25%,22% 60%,50% 0,78% 60%,100% 25%,100% 100%)",
          background: "#FFC93C",
          boxShadow: `inset 0 ${-0.4 * em}px 0 rgba(0,0,0,.18)`,
        })}
        {abs(3.2 * 0.44, 2.2 * 0.55, 0.45, 0.45, { borderRadius: "50%", background: "#FF5A5F" })}
      </>,
    );

  if (id === "kente") {
    const s = (n: number) => `${n * em}px`;
    return abs(
      3.4,
      1.4,
      5.2,
      2.4,
      { transform: "rotate(-5deg)" },
      <>
        {abs(0, 0, 5.2, 2.4, {
          borderRadius: `${s(2.6)} ${s(2.6)} ${s(0.4)} ${s(0.4)}`,
          backgroundImage: `repeating-linear-gradient(90deg,#FFC93C 0 ${s(0.5)},#167A45 ${s(0.5)} ${s(1)},#C62828 ${s(1)} ${s(1.25)},#0E0F1A ${s(1.25)} ${s(1.5)})`,
        })}
        {abs(-0.2, 2.1, 5.6, 0.6, { borderRadius: 0.3 * em, background: "#FFC93C" })}
      </>,
    );
  }

  if (id === "beanie") {
    const s = (n: number) => `${n * em}px`;
    return abs(
      3.1,
      0.5,
      5.8,
      3.3,
      { transform: "rotate(-6deg)" },
      <>
        {abs(2.55, 0, 0.3, 0.9, { borderRadius: 0.15 * em, background: "#167A45" })}
        {abs(1.75, 0.05, 0.95, 0.55, { borderRadius: "100% 0", background: "#167A45" })}
        {abs(2.75, -0.1, 1.05, 0.6, { borderRadius: "0 100%", background: "#167A45" })}
        {abs(0.2, 0.75, 5.4, 1.95, {
          borderRadius: `${s(2.7)} ${s(2.7)} 0 0`,
          background: "#B8F23A",
          boxShadow: `inset ${-0.35 * em}px ${-0.2 * em}px 0 rgba(0,0,0,.14)`,
        })}
        {abs(0, 2.35, 5.8, 0.95, {
          borderRadius: 0.4 * em,
          backgroundImage: `repeating-linear-gradient(90deg,#B8F23A 0 ${s(0.35)},#167A45 ${s(0.35)} ${s(0.5)})`,
        })}
      </>,
    );
  }

  if (id === "shades") {
    const lens = (l: number, t: number, w: number, h: number) =>
      abs(l, t, w, h, {
        borderRadius: `${0.45 * em}px ${0.45 * em}px ${em}px ${em}px`,
        backgroundImage: "linear-gradient(160deg,#2B2F4A 0%,#2B2F4A 30%,#0E0F1A 30%,#0E0F1A 100%)",
        boxShadow: `inset 0 0 0 ${0.16 * em}px #0E0F1A`,
      });
    return full(
      { transform: "rotate(-3deg)" },
      <>
        {abs(1.75, 5.05, 7.9, 0.32, { borderRadius: 0.16 * em, background: "#0E0F1A" })}
        {lens(2.85, 4.55, 3.1, 2.75)}
        {lens(6.4, 4.85, 2.25, 2.3)}
        {abs(3.3, 4.95, 0.9, 0.22, { borderRadius: 0.11 * em, background: "#2FD3E0", opacity: 0.8 })}
      </>,
    );
  }

  if (id === "headphones") {
    const cup = (l: number) =>
      abs(l, 5, 1.55, 2.6, {
        borderRadius: 0.75 * em,
        background: "#8B7CFF",
        boxShadow: `inset ${-0.25 * em}px ${-0.3 * em}px 0 rgba(0,0,0,.22), 0 0 0 ${0.14 * em}px #0E0F1A`,
      });
    return full(
      {},
      <>
        {abs(1.25, 1.75, 9.6, 5.2, {
          borderTop: `${0.55 * em}px solid #5B4BD6`,
          borderLeft: `${0.55 * em}px solid #5B4BD6`,
          borderRight: `${0.55 * em}px solid #5B4BD6`,
          borderRadius: `${4.8 * em}px ${4.8 * em}px 0 0`,
        })}
        {cup(0.7)}
        {cup(9.85)}
        {abs(10.15, 5.55, 0.5, 0.5, { borderRadius: "50%", background: "#B8F23A" })}
      </>,
    );
  }

  if (id === "chef") {
    const puff = (l: number, t: number, s: number) =>
      abs(l, t, s, s, {
        borderRadius: "50%",
        background: "#F4F5FB",
        boxShadow: `inset ${-0.25 * em}px ${-0.25 * em}px 0 rgba(14,15,26,.10)`,
      });
    return full(
      { transform: "rotate(-5deg)" },
      <>
        {puff(3.2, 0.75, 2.4)}
        {puff(6.1, 0.75, 2.4)}
        {puff(4.45, -0.05, 2.9)}
        {abs(3.75, 1.9, 4.3, 1.55, {
          background: "#F4F5FB",
          borderRadius: `0 0 ${0.3 * em}px ${0.3 * em}px`,
          boxShadow: `inset 0 ${-0.3 * em}px 0 rgba(14,15,26,.10)`,
        })}
        {abs(3.6, 3, 4.6, 0.55, { background: "#D9DCEB", borderRadius: 0.27 * em })}
      </>,
    );
  }

  // party (default)
  return abs(
    4.6,
    0.1,
    2.8,
    3.2,
    { transform: "rotate(-12deg)", transformOrigin: "50% 100%" },
    <>
      {abs(0, 0, 2.8, 3.2, {
        clipPath: "polygon(50% 0,100% 100%,0 100%)",
        backgroundImage: `repeating-linear-gradient(135deg,#FFC93C 0 ${0.45 * em}px,#FF5A5F ${0.45 * em}px ${0.9 * em}px)`,
      })}
      {abs(0.95, -0.5, 0.9, 0.9, { borderRadius: "50%", background: "#F4F5FB" })}
    </>,
  );
}
