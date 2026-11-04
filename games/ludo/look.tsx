"use client";

import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { prefersReducedMotion, useSettings } from "@/lib/settings/store";
import { HOME_COL_CELLS, SAFE, TRACK, baseOfCell, cellOf, startOf } from "./engine";

/**
 * The Ludo look, shared by the Ludo puzzle and live Board Games matches: a printed board seen at a slight angle
 * (classic red, green, yellow and blue, a white track with stars, the coloured centre triangles), pawns that stand
 * up off it, and a real die that tumbles and lands on the roll. Every colour still carries a shape on its pawn's
 * head, so the colours are never the only way to tell players apart.
 */
export const LUDO_LOOK = [
  { c: "#D7303F", light: "#F2737D", dark: "#8E1522", name: "red", shape: "circle" },
  { c: "#2E9E4F", light: "#6FD08B", dark: "#17602D", name: "green", shape: "square" },
  { c: "#F2B632", light: "#FFDC86", dark: "#A8740B", name: "yellow", shape: "diamond" },
  { c: "#2F6FD6", light: "#78A6F0", dark: "#173F86", name: "blue", shape: "drop" },
] as const;

const N = 15;
/** The board leans back by this much (deg); pawns lean forward by the same so they stand upright. */
export const LUDO_TILT = 24;

function useReduced() {
  const hydrated = useSettings((s) => s.hydrated);
  const reduced = useSettings((s) => prefersReducedMotion(s));
  return hydrated && reduced;
}

/* ---------------- Pawn ---------------- */

/** A turned wooden pawn: base, waisted body, collar and ball head, lit from the top left, with its shape on top. */
export function Pawn({ colour, size, glow }: { colour: number; size: number; glow?: boolean }) {
  const l = LUDO_LOOK[colour];
  const id = `pawn-${colour}`;
  const mark =
    l.shape === "circle" ? (
      <circle cx="20" cy="13" r="3.2" fill="#fff" fillOpacity=".9" />
    ) : l.shape === "square" ? (
      <rect x="17" y="10" width="6" height="6" rx="1" fill="#fff" fillOpacity=".9" />
    ) : l.shape === "diamond" ? (
      <rect x="17.2" y="10.2" width="5.6" height="5.6" rx=".8" fill="#fff" fillOpacity=".9" transform="rotate(45 20 13)" />
    ) : (
      <path d="M20 9.2c2.4 2.7 3.6 4.4 3.6 5.6a3.6 3.6 0 0 1-7.2 0c0-1.2 1.2-2.9 3.6-5.6Z" fill="#fff" fillOpacity=".9" />
    );
  return (
    <svg aria-hidden width={size} height={size * 1.4} viewBox="0 0 40 56" style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id={`${id}-b`} x1="0" x2="1">
          <stop offset="0" stopColor={l.light} />
          <stop offset=".45" stopColor={l.c} />
          <stop offset="1" stopColor={l.dark} />
        </linearGradient>
        <radialGradient id={`${id}-h`} cx=".35" cy=".3" r=".75">
          <stop offset="0" stopColor="#fff" stopOpacity=".85" />
          <stop offset=".25" stopColor={l.light} />
          <stop offset=".7" stopColor={l.c} />
          <stop offset="1" stopColor={l.dark} />
        </radialGradient>
      </defs>
      {glow && <ellipse cx="20" cy="50" rx="19" ry="7.5" fill="none" stroke="#fff" strokeWidth="2.5" opacity=".95" />}
      <ellipse cx="21" cy="51.5" rx="15" ry="5" fill="#000" opacity=".35" />
      <ellipse cx="20" cy="48" rx="14" ry="5.2" fill={l.dark} />
      <path
        d="M6 47.5c0-2.6 4.5-4.2 6-4.6 1.6-5 3.7-12.6 3.9-19.2h8.2c.2 6.6 2.3 14.2 3.9 19.2 1.5.4 6 2 6 4.6 0 2.8-6.3 4.6-14 4.6S6 50.3 6 47.5Z"
        fill={`url(#${id}-b)`}
      />
      <ellipse cx="20" cy="24" rx="7.6" ry="2.6" fill={l.dark} />
      <ellipse cx="20" cy="23.2" rx="7.6" ry="2.4" fill={`url(#${id}-b)`} />
      <circle cx="20" cy="13" r="9.6" fill={`url(#${id}-h)`} />
      {mark}
    </svg>
  );
}

/* ---------------- Die ---------------- */

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
/** Each face's place on the cube (opposite faces add to 7). */
const FACE: Record<number, string> = {
  1: "rotateY(0deg)",
  6: "rotateY(180deg)",
  3: "rotateY(90deg)",
  4: "rotateY(-90deg)",
  2: "rotateX(90deg)",
  5: "rotateX(-90deg)",
};
/** The cube's turn that brings each face to the front. */
const SHOW: Record<number, [number, number]> = { 1: [0, 0], 6: [0, -180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };

const up = (from: number, to: number) => to + 360 * Math.ceil((from - to) / 360);

/**
 * A real die: a cube with pipped faces. `value` is the face to land on; a new `rollKey` throws it (it tumbles and
 * lands on `value`). While `rolling` it keeps tumbling (waiting for the server's roll), then settles.
 */
export function Die3D({
  value,
  rollKey,
  rolling = false,
  size = 60,
  onRoll,
  disabled,
  label,
}: {
  value: number | null;
  rollKey: string | number;
  rolling?: boolean;
  size?: number;
  onRoll?: () => void;
  disabled?: boolean;
  label: string;
}) {
  const reduce = useReduced();
  const [rot, setRot] = useState<{ x: number; y: number; ms: number; ease: string }>(() => {
    const [x, y] = SHOW[value ?? 1];
    return { x: x - 20, y: y + 25, ms: 0, ease: "linear" };
  });
  const [hop, setHop] = useState(0);
  // React to a new throw, the start of a wait, or the value arriving: work out the next turn of the cube here,
  // during render (props changed), rather than in an effect.
  const [seen, setSeen] = useState({ rollKey, rolling, value });
  if (seen.rollKey !== rollKey || seen.rolling !== rolling || seen.value !== value) {
    setSeen({ rollKey, rolling, value });
    if (rolling && !seen.rolling && !reduce) {
      // waiting on the server: keep tumbling
      setRot((r) => ({ x: r.x + 900, y: r.y + 720, ms: 1600, ease: "linear" }));
      setHop((h) => h + 1);
    } else if (!rolling && value !== null) {
      // land on the value, with a couple of full turns on the way
      const [x, y] = SHOW[value];
      const spin = reduce ? 0 : 360;
      setRot((r) => ({
        x: up(r.x + spin, x) - 20,
        y: up(r.y + spin, y) + 25,
        ms: reduce ? 0 : 750,
        ease: "cubic-bezier(.17,.84,.32,1.06)",
      }));
      if (!reduce && !seen.rolling) setHop((h) => h + 1);
    }
  }

  const half = size / 2;
  const face = (n: number): CSSProperties => ({
    position: "absolute",
    inset: 0,
    transform: `${FACE[n]} translateZ(${half}px)`,
    background: "radial-gradient(circle at 30% 25%, #FFFFFF, #F1ECE2 60%, #DCD3C2)",
    borderRadius: size * 0.18,
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08), inset 0 -3px 6px rgba(0,0,0,.12)",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gridTemplateRows: "repeat(3, 1fr)",
    padding: size * 0.14,
    gap: size * 0.04,
    backfaceVisibility: "hidden",
  });
  const cube = (
    <span
      className="relative block"
      style={{
        width: size,
        height: size,
        transformStyle: "preserve-3d",
        transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
        transition: rot.ms ? `transform ${rot.ms}ms ${rot.ease}` : undefined,
      }}
    >
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <span key={n} style={face(n)}>
          {Array.from({ length: 9 }, (_, k) => (
            <span
              key={k}
              className="rounded-full"
              style={{
                margin: "12%",
                background: PIPS[n].includes(k) ? (n === 1 ? "#C21E2C" : "#1B1C26") : "transparent",
                boxShadow: PIPS[n].includes(k) ? "inset 0 2px 2px rgba(0,0,0,.45)" : undefined,
              }}
            />
          ))}
        </span>
      ))}
    </span>
  );
  const body = (
    <span className="relative flex flex-col items-center" style={{ perspective: size * 8 }}>
      <span key={hop} className={hop && !reduce ? "ludo-die-hop" : undefined} style={{ display: "block" }}>
        {cube}
      </span>
      <span
        aria-hidden
        className="block rounded-[50%]"
        style={{ width: size * 0.9, height: size * 0.18, marginTop: size * 0.1, background: "rgba(0,0,0,.35)", filter: "blur(3px)" }}
      />
    </span>
  );
  return (
    <>
      <style>{`@keyframes ludo-die-hop{0%{transform:translateY(0)}35%{transform:translateY(-${Math.round(size * 0.45)}px)}70%{transform:translateY(0)}84%{transform:translateY(-${Math.round(size * 0.08)}px)}100%{transform:translateY(0)}}.ludo-die-hop{animation:ludo-die-hop 760ms cubic-bezier(.3,.7,.4,1)}`}</style>
      {onRoll ? (
        <button
          type="button"
          onClick={onRoll}
          disabled={disabled}
          aria-label={label}
          className="press flex-none rounded-[18px] p-1 disabled:cursor-default"
        >
          {body}
        </button>
      ) : (
        <span role="img" aria-label={label} className="flex-none p-1">
          {body}
        </span>
      )}
    </>
  );
}

/* ---------------- Board ---------------- */

export interface LudoPiece {
  key: string;
  r: number;
  c: number;
  colour: number;
  glow?: boolean;
  /** lifted (picked) */
  lifted?: boolean;
  className?: string;
}

const QUAD: [number, number][] = [
  [0, 0],
  [0, 9],
  [9, 9],
  [9, 0],
];

/** The printed board as one picture: bases, track, home columns, stars and the centre. */
function BoardArt({ cell, startColours }: { cell: number; startColours: Map<number, number> }) {
  const S = N * cell;
  const sq = (r: number, c: number, fill: string, k: string, stroke = true) => (
    <rect
      key={k}
      x={c * cell}
      y={r * cell}
      width={cell}
      height={cell}
      fill={fill}
      stroke={stroke ? "#2B2620" : "none"}
      strokeOpacity=".35"
      strokeWidth="1"
    />
  );
  const parts: ReactNode[] = [];
  // bases: a coloured square with a white yard and four coloured spots
  QUAD.forEach(([r0, c0], q) => {
    const col = baseOfCell(r0, c0);
    const l = LUDO_LOOK[col];
    parts.push(<rect key={`b${q}`} x={c0 * cell} y={r0 * cell} width={6 * cell} height={6 * cell} fill={l.c} />);
    parts.push(
      <rect
        key={`y${q}`}
        x={(c0 + 0.7) * cell}
        y={(r0 + 0.7) * cell}
        width={4.6 * cell}
        height={4.6 * cell}
        rx={cell * 0.5}
        fill="#FBF7EE"
        stroke="rgba(0,0,0,.18)"
      />,
    );
    for (let k = 0; k < 4; k++) {
      const [r, c] = cellOf(col, k, -1);
      parts.push(
        <circle
          key={`s${q}${k}`}
          cx={(c + 0.5) * cell}
          cy={(r + 0.5) * cell}
          r={cell * 0.62}
          fill={l.c}
          opacity=".9"
          stroke={l.dark}
          strokeWidth="1.5"
        />,
      );
    }
  });
  // track
  TRACK.forEach(([r, c], i) => {
    const start = i % 13 === 0 ? startColours.get(i) : undefined;
    parts.push(sq(r, c, start !== undefined ? LUDO_LOOK[start].c : "#FBF7EE", `t${i}`));
    if (SAFE.has(i) && i % 13 !== 0)
      parts.push(
        <path
          key={`st${i}`}
          transform={`translate(${(c + 0.5) * cell} ${(r + 0.5) * cell}) scale(${cell / 26})`}
          d="M0-9 2.6-3.1 9-2.8 4-1 5.6 6.8 0 3.2-5.6 6.8-4-1-9-2.8-2.6-3.1Z"
          fill="none"
          stroke="#6B6252"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />,
      );
    if (start !== undefined)
      parts.push(
        <path
          key={`ar${i}`}
          transform={`translate(${(c + 0.5) * cell} ${(r + 0.5) * cell}) scale(${cell / 26})`}
          d="M-5-6 5 0-5 6Z"
          fill="#fff"
          opacity=".9"
        />,
      );
  });
  // home columns
  HOME_COL_CELLS.forEach((cells, col) => cells.forEach(([r, c], k) => parts.push(sq(r, c, LUDO_LOOK[col].c, `h${col}${k}`))));
  // centre: four triangles pointing in, each the colour of the column that runs into it
  const cx = 7.5 * cell,
    a = 6 * cell,
    b = 9 * cell;
  const tri = (pts: string, col: number, k: string) => (
    <polygon key={k} points={pts} fill={LUDO_LOOK[col].c} stroke="#2B2620" strokeOpacity=".35" />
  );
  parts.push(
    tri(
      `${a},${a} ${a},${b} ${cx},${cx}`,
      HOME_COL_CELLS.findIndex((x) => x[0][0] === 7 && x[0][1] < 7),
      "cl",
    ),
  );
  parts.push(
    tri(
      `${a},${a} ${b},${a} ${cx},${cx}`,
      HOME_COL_CELLS.findIndex((x) => x[0][1] === 7 && x[0][0] < 7),
      "ct",
    ),
  );
  parts.push(
    tri(
      `${b},${a} ${b},${b} ${cx},${cx}`,
      HOME_COL_CELLS.findIndex((x) => x[0][0] === 7 && x[0][1] > 7),
      "cr",
    ),
  );
  parts.push(
    tri(
      `${a},${b} ${b},${b} ${cx},${cx}`,
      HOME_COL_CELLS.findIndex((x) => x[0][1] === 7 && x[0][0] > 7),
      "cb",
    ),
  );
  return (
    <svg aria-hidden width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="absolute inset-0 block">
      <rect width={S} height={S} fill="#FBF7EE" />
      {parts}
    </svg>
  );
}

/**
 * The board with pawns. Cells are an invisible 15 × 15 grid on top of the picture, so tapping, keyboard focus and
 * screen-reader labels work as before; `cellLabel` and `onCell` come from the screen that owns the rules.
 */
export function LudoTable({
  cell,
  pieces,
  dest,
  label,
  focus,
  onKeyDown,
  cellLabel,
  onCell,
  interactive,
  hintCell,
}: {
  cell: number;
  pieces: LudoPiece[];
  dest?: [number, number] | null;
  label: string;
  focus?: number;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  cellLabel: (i: number) => string | undefined;
  onCell: (i: number) => void;
  /** cells that can be tapped (a movable piece) */
  interactive: (i: number) => boolean;
  hintCell?: number;
}) {
  const reduce = useReduced();
  const tilt = reduce ? 0 : LUDO_TILT;
  const startColours = new Map([0, 1, 2, 3].map((col) => [startOf(col), col]));
  const at = new Map<number, LudoPiece[]>();
  for (const p of pieces) {
    const i = p.r * N + p.c;
    at.set(i, [...(at.get(i) ?? []), p]);
  }
  const S = N * cell;
  return (
    <div style={{ perspective: S * 2.6, perspectiveOrigin: "50% 0%", paddingTop: tilt ? cell * 0.6 : 0 }}>
      <div
        className="relative rounded-[14px] p-[7px]"
        style={{
          transformStyle: "preserve-3d",
          transform: tilt ? `rotateX(${tilt}deg)` : undefined,
          transformOrigin: "50% 100%",
          background: "linear-gradient(135deg, #8A5A34, #5C3A1F 55%, #3F2814)",
          boxShadow: "0 18px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.25)",
        }}
      >
        <div
          role="grid"
          aria-label={label}
          aria-rowcount={N}
          aria-colcount={N}
          onKeyDown={onKeyDown}
          className="relative grid overflow-visible rounded-[6px]"
          style={{
            gridTemplateColumns: `repeat(${N}, ${cell}px)`,
            gridTemplateRows: `repeat(${N}, ${cell}px)`,
            width: S,
            height: S,
            transformStyle: "preserve-3d",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,.4)",
          }}
        >
          <BoardArt cell={cell} startColours={startColours} />
          {Array.from({ length: N }, (_, r) => (
            <div role="row" key={r} className="contents">
              {Array.from({ length: N }, (_, c) => {
                const i = r * N + c;
                const here = at.get(i) ?? [];
                const isDest = !!dest && dest[0] === r && dest[1] === c;
                const can = interactive(i);
                const lbl = cellLabel(i);
                return (
                  <div
                    key={i}
                    role="gridcell"
                    data-i={i}
                    tabIndex={focus === undefined ? undefined : focus === i ? 0 : -1}
                    aria-label={lbl}
                    onClick={() => onCell(i)}
                    className={`relative outline-none focus-visible:shadow-[var(--focus-ring)] ${hintCell === i ? "hint-ring" : ""}`}
                    style={{
                      cursor: can ? "pointer" : undefined,
                      transformStyle: "preserve-3d",
                      boxShadow: isDest ? "inset 0 0 0 3px #fff, inset 0 0 0 5px rgba(0,0,0,.35)" : undefined,
                      borderRadius: 3,
                    }}
                  >
                    {here.map((p, k) => {
                      const n = here.length;
                      const dx = n > 1 ? (k - (n - 1) / 2) * cell * 0.28 : 0;
                      return (
                        <span
                          key={p.key}
                          className={`absolute ${p.className ?? ""}`}
                          style={{
                            left: cell * 0.09 + dx,
                            bottom: cell * 0.12,
                            zIndex: 2 + k,
                            transformOrigin: "50% 100%",
                            transform: `rotateX(${-tilt}deg)${p.lifted ? " translateY(-14%)" : ""}`,
                            transition: "transform 160ms var(--ease-out)",
                            pointerEvents: "none",
                          }}
                        >
                          <Pawn colour={p.colour} size={cell * 0.82} glow={p.glow} />
                        </span>
                      );
                    })}
                    {can && <span aria-hidden className="absolute -inset-2" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A small flat badge of a player's colour and shape (player chips and lists). */
export function ColourBadge({ colour, size = 14 }: { colour: number; size?: number }) {
  const l = LUDO_LOOK[colour];
  return (
    <span
      aria-hidden
      className="flex flex-none items-center justify-center rounded-full"
      style={{ width: size, height: size, background: l.c, boxShadow: `inset 0 -2px 0 ${l.dark}` }}
    >
      <Icon
        name={l.shape === "circle" ? "circle" : l.shape === "square" ? "square" : l.shape === "diamond" ? "diamond" : "drop"}
        size={Math.round(size * 0.55)}
        style={{ color: "#fff" }}
      />
    </span>
  );
}
