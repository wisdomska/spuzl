import type { CSSProperties, ReactNode } from "react";
import type { SpuzMood } from "@/components/brand/Spuz";

/**
 * Spuz for `next/og` (Satori): the static pose of components/brand/Spuz.tsx, drawn with plain
 * absolutely positioned divs. Satori has no CSS animations, no `em` scaling we can rely on and no
 * `inset`, so every length is computed in px from `size` (1 em = size / 12, same as the DOM version),
 * and every div is `display: flex` (Satori requires it for multi-child nodes).
 * Geometry is copied 1:1 from Spuz.tsx; keep the two in sync when the mascot changes.
 */

const INK = "#0E0F1A";

interface Pose {
  eyes: "round" | "big" | "happy" | "sleepy" | "x";
  mouth: "smile" | "grin" | "flat" | "o" | "frown";
  arm?: boolean;
  cheeks?: boolean | "rage";
  look?: [number, number];
  brows?: [number, number];
  bubble?: boolean;
  confetti?: boolean;
  sparkles?: boolean;
  t?: { sx: number; sy: number; ty?: number };
  flame?: boolean;
  zzz?: boolean;
  tuftDeg?: number;
  steam?: boolean;
  sweat?: boolean;
  tear?: boolean;
  hat?: boolean;
  /** brow lift for "thinking" (em) */
  browLift?: number;
}

const POSES: Record<SpuzMood, Pose> = {
  idle: { eyes: "round", mouth: "smile" },
  wave: { eyes: "round", mouth: "grin", arm: true, cheeks: true },
  thinking: { eyes: "round", mouth: "flat", look: [0.6, -0.8], brows: [-10, 0], browLift: -0.2, bubble: true },
  cheer: { eyes: "happy", mouth: "grin", confetti: true, cheeks: true },
  proud: { eyes: "happy", mouth: "smile", sparkles: true, cheeks: true, t: { sx: 1.05, sy: 1.02 } },
  fire: { eyes: "round", mouth: "grin", flame: true, look: [0, -0.3] },
  sleepy: { eyes: "sleepy", mouth: "o", zzz: true, tuftDeg: 30 },
  squish: { eyes: "x", mouth: "flat", t: { sx: 1.34, sy: 0.5 } },
  rage: { eyes: "round", mouth: "frown", brows: [20, -20], cheeks: "rage", steam: true },
  shocked: { eyes: "big", mouth: "o", sweat: true, t: { sx: 0.95, sy: 1.07, ty: -0.35 } },
  sad: { eyes: "round", mouth: "frown", brows: [-16, 16], tear: true, look: [0, 0.7], tuftDeg: 44, t: { sx: 1.03, sy: 0.95 } },
  party: { eyes: "happy", mouth: "grin", hat: true, confetti: true, cheeks: true },
};

export interface SpuzOGProps {
  mood?: SpuzMood;
  size?: number;
  color?: string;
  /** colour of the floor shadow ellipse (on light cards a darker tint reads better) */
  shadow?: string;
}

export function SpuzOG({ mood = "idle", size = 120, color = "#B8F23A", shadow = "rgba(0,0,0,.28)" }: SpuzOGProps) {
  const m = POSES[mood] ?? POSES.idle;
  const u = size / 12;
  const e = (n: number) => n * u;
  // Satori rejects `undefined` CSS values, so they are dropped before rendering.
  const box = (left: number, top: number, w: number, h: number, st: CSSProperties = {}, kids?: ReactNode) => (
    <div
      style={{
        position: "absolute",
        display: "flex",
        left: e(left),
        top: e(top),
        width: e(w),
        height: e(h),
        ...(Object.fromEntries(Object.entries(st).filter(([, v]) => v !== undefined)) as CSSProperties),
      }}
    >
      {kids}
    </div>
  );
  // Elements in Spuz.tsx anchored by `bottom` are converted to top = 12em - bottom - height.
  const fromBottom = (bottom: number, h: number) => 12 - bottom - h;

  const big = m.eyes === "big";
  const lx = m.look ? m.look[0] : 0;
  const ly = m.look ? m.look[1] : 0;
  const lookL = { x: (lx + (m.look ? 0 : 0.35)) * 0.4, y: (ly - (m.look ? 0 : 0.25)) * 0.45 };
  const lookR = { x: (lx - (m.look ? 0 : 0.45)) * 0.28, y: (ly + (m.look ? 0 : 0.4)) * 0.3 };
  const cheek = m.cheeks === "rage" ? "rgba(255,59,59,.85)" : "rgba(255,122,138,.5)";
  const shade = `inset ${e(-0.55)}px ${e(-0.65)}px 0 rgba(0,0,0,.16), inset ${e(0.45)}px ${e(0.4)}px 0 rgba(255,255,255,.28)`;
  const star = "polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)";

  // Body block: 9em × 7.6em at left 1.5em, bottom 1.35em. Its transform scales from the bottom centre.
  const bodyTop = fromBottom(1.35, 7.6);
  const t = m.t;
  const bodyTransform = t ? `translateY(${e(t.ty ?? 0)}px) scale(${t.sx}, ${t.sy})` : undefined;

  const eye = (left: number, top: number, w: number, h: number, pupil: number, look: { x: number; y: number }) =>
    box(
      left,
      top,
      w,
      h,
      { borderRadius: "50%", background: "#fff", boxShadow: `0 0 0 ${e(0.16)}px ${INK}`, overflow: "hidden" },
      box(
        w / 2 - pupil / 2 + look.x,
        h / 2 - pupil / 2 + look.y,
        pupil,
        pupil,
        { borderRadius: "50%", background: INK },
        box(pupil * 0.18, pupil * 0.16, pupil * 0.32, pupil * 0.32, { borderRadius: "50%", background: "#fff" }),
      ),
    );
  const pupil = big ? 0.7 : 1.05;

  const arc = (left: number, top: number, w: number, h: number, up: boolean, thick: number) =>
    box(left, top, w, h, {
      border: `${e(thick)}px solid ${INK}`,
      ...(up ? { borderBottomWidth: 0 } : { borderTopWidth: 0 }),
      borderRadius: up ? `${e(1)}px ${e(1)}px 0 0` : `0 0 ${e(1)}px ${e(1)}px`,
    });

  return (
    <div style={{ position: "relative", display: "flex", width: size, height: size, flexShrink: 0 }}>
      {/* floor shadow */}
      {box(2.4, fromBottom(0.45, 0.9), 7.2, 0.9, { borderRadius: "50%", background: shadow })}
      {/* feet */}
      {box(2.6, fromBottom(0.8, 1.1), 2.3, 1.1, {
        transform: "rotate(-14deg)",
        borderRadius: `${e(1.1)}px ${e(1)}px ${e(0.6)}px ${e(0.6)}px`,
        background: color,
        boxShadow: `inset 0 ${e(-0.32)}px 0 rgba(0,0,0,.28)`,
      })}
      {box(6.5, fromBottom(0.85, 1.3), 1.7, 1.3, {
        transform: "rotate(10deg)",
        borderRadius: `${e(1)}px ${e(1)}px ${e(0.6)}px ${e(0.6)}px`,
        background: color,
        boxShadow: `inset 0 ${e(-0.32)}px 0 rgba(0,0,0,.28)`,
      })}
      {box(
        1.5,
        bodyTop,
        9,
        7.6,
        { transform: bodyTransform, transformOrigin: "50% 100%" },
        <>
          {!m.flame &&
            !m.hat &&
            box(
              3.9,
              -2.9,
              1.3,
              3.4,
              { transform: m.tuftDeg ? `rotate(${m.tuftDeg}deg)` : undefined, transformOrigin: "50% 100%" },
              <>
                {box(0.25, 0.9, 0.8, 2.6, {
                  borderRadius: e(0.4),
                  background: color,
                  boxShadow: `inset ${e(-0.2)}px 0 0 rgba(0,0,0,.14)`,
                })}
                {box(-0.25, -0.2, 1.8, 1.6, {
                  borderRadius: "52% 48% 46% 54%",
                  background: color,
                  boxShadow: `inset ${e(-0.3)}px ${e(-0.25)}px 0 rgba(0,0,0,.14), inset ${e(0.2)}px ${e(0.2)}px 0 rgba(255,255,255,.3)`,
                })}
              </>,
            )}
          {m.flame && (
            <>
              {box(
                3.3,
                -2.5,
                2.5,
                2.5,
                {
                  borderRadius: "50% 0 50% 50%",
                  backgroundImage: "linear-gradient(45deg,#FF6B2C,#FFC93C)",
                  transform: "rotate(-45deg)",
                },
                box(0.7, 0.7, 1.1, 1.1, { borderRadius: "50% 0 50% 50%", background: "#FFF1B8" }),
              )}
              {box(3.6, -2.6, 0.35, 0.35, { borderRadius: "50%", background: "#FFC93C" })}
              {box(5.2, -2.2, 0.28, 0.28, { borderRadius: "50%", background: "#FF8A3D" })}
            </>
          )}
          {m.hat &&
            box(
              3.1,
              -2.9,
              2.8,
              3.2,
              { transform: "rotate(-12deg)", transformOrigin: "50% 100%" },
              <>
                {box(0, 0, 2.8, 3.2, {
                  clipPath: "polygon(50% 0,100% 100%,0 100%)",
                  backgroundImage: `repeating-linear-gradient(135deg,#FFC93C 0 ${e(0.45)}px,#FF5A5F ${e(0.45)}px ${e(0.9)}px)`,
                })}
                {box(0.95, -0.5, 0.9, 0.9, { borderRadius: "50%", background: "#F4F5FB" })}
              </>,
            )}
          {/* side tab */}
          {box(8, 2.6, 2.1, 2.1, {
            borderRadius: "50%",
            background: color,
            boxShadow: `inset ${e(-0.4)}px ${e(-0.3)}px 0 rgba(0,0,0,.14)`,
          })}
          {m.arm &&
            box(8.5, 0.2, 1.3, 2.7, {
              borderRadius: e(0.7),
              background: color,
              boxShadow: `inset ${e(-0.25)}px 0 0 rgba(0,0,0,.14)`,
            })}
          {/* body */}
          {box(0, 0, 9, 7.6, {
            borderTopLeftRadius: `${e(3.6)}px ${e(3.4)}px`,
            borderTopRightRadius: `${e(2.6)}px ${e(3)}px`,
            borderBottomRightRadius: `${e(3)}px ${e(2.5)}px`,
            borderBottomLeftRadius: `${e(3.3)}px ${e(2.9)}px`,
            background: color,
            boxShadow: shade,
          })}
          {/* face */}
          {m.cheeks && (
            <>
              {box(1.05, 4.3, 1.4, 0.75, { borderRadius: "50%", background: cheek })}
              {box(6.55, 4.3, 1.4, 0.75, { borderRadius: "50%", background: cheek })}
            </>
          )}
          {(m.eyes === "round" || big) && (
            <>
              {eye(big ? 1.5 : 1.7, big ? 1.4 : 1.65, big ? 2.8 : 2.4, big ? 3 : 2.6, pupil, lookL)}
              {eye(big ? 4.95 : 5.15, big ? 2 : 2.25, big ? 2 : 1.6, big ? 2.2 : 1.75, pupil * 0.8, lookR)}
            </>
          )}
          {m.eyes === "happy" && (
            <>
              {arc(1.8, 2.6, 2.2, 1.1, true, 0.36)}
              {arc(5.15, 3, 1.5, 0.8, true, 0.36)}
            </>
          )}
          {m.eyes === "sleepy" && (
            <>
              {arc(2.1, 3.05, 1.8, 0.9, false, 0.34)}
              {arc(5.15, 3.3, 1.5, 0.75, false, 0.34)}
            </>
          )}
          {m.eyes === "x" &&
            [2.1, 5.05].map((left) =>
              box(
                left,
                2.4,
                1.8,
                1.8,
                {},
                <>
                  {box(0, 0.73, 1.8, 0.34, { borderRadius: e(0.2), background: INK, transform: "rotate(45deg)" })}
                  {box(0, 0.73, 1.8, 0.34, { borderRadius: e(0.2), background: INK, transform: "rotate(-45deg)" })}
                </>,
              ),
            )}
          {m.brows && (
            <>
              {box(2.05, 1.35 + (m.browLift ?? 0), 1.9, 0.36, {
                borderRadius: e(0.2),
                background: INK,
                transform: `rotate(${m.brows[0]}deg)`,
              })}
              {box(5.05, 1.35, 1.9, 0.36, { borderRadius: e(0.2), background: INK, transform: `rotate(${m.brows[1]}deg)` })}
            </>
          )}
          {m.mouth === "smile" && (
            <>
              {box(3.2, 4.55, 2.7, 1, {
                border: `${e(0.34)}px solid ${INK}`,
                borderTopWidth: 0,
                borderRadius: `0 0 ${e(1.4)}px ${e(1)}px`,
                transform: "rotate(-6deg)",
              })}
              {box(4.15, 5.38, 0.62, 0.62, {
                borderRadius: `0 0 ${e(0.18)}px ${e(0.18)}px`,
                background: "#fff",
                boxShadow: `0 0 0 ${e(0.13)}px ${INK}`,
                transform: "rotate(-6deg)",
              })}
            </>
          )}
          {m.mouth === "grin" &&
            box(
              3.1,
              4.45,
              2.8,
              1.35,
              { borderRadius: `${e(0.3)}px ${e(0.5)}px ${e(1.4)}px ${e(1.2)}px`, background: INK, transform: "rotate(-5deg)" },
              <>
                {box(0.3, 0, 0.55, 0.45, { borderRadius: `0 0 ${e(0.15)}px ${e(0.15)}px`, background: "#fff" })}
                {box(1.35, 0.75, 1, 1.15, {
                  borderRadius: `${e(0.2)}px ${e(0.2)}px ${e(0.55)}px ${e(0.55)}px`,
                  background: "#FF7A8A",
                  boxShadow: `0 0 0 ${e(0.13)}px ${INK}`,
                })}
              </>,
            )}
          {m.mouth === "o" && box(4, 4.75, 1, 1.2, { borderRadius: "50%", background: INK })}
          {m.mouth === "flat" && box(3.8, 5.05, 1.4, 0.34, { borderRadius: e(0.2), background: INK })}
          {m.mouth === "frown" && arc(3.7, 4.95, 1.6, 0.8, true, 0.34)}
          {m.tear && box(1.6, 4.55, 0.7, 0.7, { borderRadius: "0 50% 50% 50%", background: "#6FB6FF", transform: "rotate(45deg)" })}
          {m.sweat && box(0.6, 1, 0.85, 0.85, { borderRadius: "0 50% 50% 50%", background: "#6FB6FF", transform: "rotate(45deg)" })}
        </>,
      )}
      {m.confetti && (
        <>
          {box(2.2, 0.6, 0.55, 0.55, { background: "#FFC93C" })}
          {box(8.6, 0.9, 0.5, 0.5, { borderRadius: "50%", background: "#2FD3E0" })}
          {box(1.1, 2.6, 0.45, 0.45, { borderRadius: "50%", background: "#FF5A5F" })}
          {box(9.9, 2.5, 0.55, 0.55, { background: "#8B7CFF" })}
          {box(6.9, 0.1, 0.4, 0.4, { background: "#F4F5FB" })}
        </>
      )}
      {m.sparkles && (
        <>
          {box(1, 1.4, 1, 1, { clipPath: star, background: "#FFC93C" })}
          {box(9.6, 0.8, 1.3, 1.3, { clipPath: star, background: "#FFC93C" })}
          {box(10.2, 4, 0.7, 0.7, { clipPath: star, background: "#F4F5FB" })}
        </>
      )}
      {m.zzz && (
        <>
          {box(8.6, 1.6, 1, 1.4, { fontFamily: "Unbounded", fontWeight: 900, fontSize: e(1.1), color: "#A2A6C2" }, "z")}
          {box(9.6, 1.2, 1.4, 2, { fontFamily: "Unbounded", fontWeight: 900, fontSize: e(1.5), color: "#A2A6C2" }, "Z")}
        </>
      )}
      {m.steam && (
        <>
          {box(3.4, 1.4, 1, 1, { borderRadius: "50%", background: "#C9CCDD" })}
          {box(5.6, 1.2, 1.3, 1.3, { borderRadius: "50%", background: "#C9CCDD" })}
          {box(4.5, 0.8, 0.8, 0.8, { borderRadius: "50%", background: "#C9CCDD" })}
        </>
      )}
      {m.bubble && (
        <>
          {box(9.2, 2.6, 0.5, 0.5, { borderRadius: "50%", background: "#A2A6C2" })}
          {box(9.8, 1.5, 0.8, 0.8, { borderRadius: "50%", background: "#A2A6C2" })}
          {box(10.5, 0.1, 1.3, 1.3, { borderRadius: "50%", background: "#A2A6C2" })}
        </>
      )}
    </div>
  );
}
