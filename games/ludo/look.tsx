"use client";

import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { prefersReducedMotion, useSettings } from "@/lib/settings/store";
import { HOME_COL_CELLS, SAFE, TRACK, baseOfCell, cellOf, startOf } from "./engine";

/**
 * The Ludo look, shared by the Ludo puzzle and live Board Games matches: a printed board facing the player (like the draughts board)
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
/** The board faces the player straight on, like the draughts board (no lean). Kept as a knob. */
export const LUDO_TILT = 0;

function useReduced() {
  const hydrated = useSettings((s) => s.hydrated);
  const reduced = useSettings((s) => prefersReducedMotion(s));
  return hydrated && reduced;
}

/* ---------------- Pawn ---------------- */

/**
 * A Ludo piece as a turned disc, the same make as the draughts pieces (games/_shared/BayStyles draughtsDisc): a
 * raised rim, a groove, a domed centre lit from the top left, its edge showing below, and the player's shape in the
 * middle so colour is never the only clue.
 */
export function Pawn({ colour, size, glow }: { colour: number; size: number; glow?: boolean }) {
  const l = LUDO_LOOK[colour];
  const edge = Math.max(2, Math.round(size * 0.09));
  const mark = Math.round(size * 0.34);
  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 50%, transparent 0 56%, rgba(0,0,0,.22) 57% 60%, transparent 61%), radial-gradient(circle at 38% 32%, ${l.light}, ${l.c} 55%, ${l.dark})`,
        boxShadow: [
          `inset 0 -${edge}px 0 ${l.dark}`,
          `inset 0 ${Math.max(1, edge - 1)}px 0 rgba(255,255,255,.35)`,
          glow ? "0 0 0 2px #fff, 0 0 0 4px rgba(0,0,0,.35)" : null,
          `0 ${edge}px 0 color-mix(in srgb, ${l.dark} 75%, #000)`,
          `0 ${edge + 3}px ${edge + 2}px rgba(0,0,0,.45)`,
        ]
          .filter(Boolean)
          .join(", "),
      }}
    >
      <Icon
        name={l.shape === "circle" ? "circle" : l.shape === "square" ? "square" : l.shape === "diamond" ? "diamond" : "drop"}
        size={mark}
        style={{ color: "rgba(255,255,255,.88)", filter: "drop-shadow(0 1px 0 rgba(0,0,0,.25))" }}
      />
    </span>
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
/** A small lean so the die reads as a cube, small enough that the face that counts faces the player. */
const TILT_X = 10;
const TILT_Y = 12;

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
    return { x: x - TILT_X, y: y + TILT_Y, ms: 0, ease: "linear" };
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
        x: up(r.x + spin, x) - TILT_X,
        y: up(r.y + spin, y) + TILT_Y,
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
    // the face that counts glows: the number read is never in doubt
    boxShadow:
      !rolling && value === n
        ? `inset 0 0 0 ${Math.max(2, Math.round(size * 0.05))}px #F2C14E, 0 0 ${Math.round(size * 0.3)}px rgba(242,193,78,.7)`
        : "inset 0 0 0 1px rgba(0,0,0,.08), inset 0 -3px 6px rgba(0,0,0,.12)",
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
                      const off = n > 1 ? (k - (n - 1) / 2) * cell * 0.16 : 0;
                      const size = Math.round(cell * (n > 1 ? 0.7 : 0.8));
                      return (
                        <span
                          key={p.key}
                          className={`absolute ${p.className ?? ""}`}
                          style={{
                            left: (cell - size) / 2 + off,
                            top: (cell - size) / 2 - off - (p.lifted ? cell * 0.12 : 0),
                            zIndex: 2 + k,
                            transition: "top 160ms var(--ease-out)",
                            pointerEvents: "none",
                          }}
                        >
                          <Pawn colour={p.colour} size={size} glow={p.glow} />
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
