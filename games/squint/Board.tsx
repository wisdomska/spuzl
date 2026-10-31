"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { differences, H, regionOf, W, type Box, type Obj, type Scene, type SquintPuzzle, type SquintState } from "./logic";

const COLS = 6;
const ROWS = 4;
const INK = "#0E0F1A";

function Thing({ o }: { o: Obj }) {
  const t = `translate(${o.x} ${o.y}) scale(${o.s})`;
  switch (o.kind) {
    case "sun":
      return (
        <g transform={t}>
          <circle cx={15} cy={15} r={15} fill={o.color} opacity={0.35} />
          <circle cx={15} cy={15} r={10} fill={o.color} />
        </g>
      );
    case "cloud":
      return (
        <g transform={t} fill="#FFFFFF" stroke={o.color} strokeWidth={1.5}>
          <ellipse cx={14} cy={13} rx={12} ry={7} />
          <ellipse cx={32} cy={13} rx={13} ry={7} />
          <ellipse cx={23} cy={8} rx={10} ry={7} />
        </g>
      );
    case "bird":
      return <path transform={t} d="M1 8 Q6 1 12 7 Q18 1 23 8" fill="none" stroke={o.color} strokeWidth={2.5} strokeLinecap="round" />;
    case "kite":
      return (
        <g transform={t}>
          <polygon points="9,0 18,10 9,22 0,10" fill={o.color} stroke={INK} strokeWidth={1} />
          <path d="M9 22 Q5 27 9 31 Q13 34 9 36" fill="none" stroke={INK} strokeWidth={1.2} />
        </g>
      );
    case "balloon":
      return (
        <g transform={t}>
          <ellipse cx={9} cy={10} rx={8.5} ry={10} fill={o.color} />
          <path d="M9 20 Q7 26 10 32" fill="none" stroke={INK} strokeWidth={1} />
        </g>
      );
    case "house":
      return (
        <g transform={t}>
          <rect x={3} y={16} width={34} height={26} fill={o.color} stroke={INK} strokeWidth={1.2} />
          <polygon points="0,17 20,0 40,17" fill="#B4520F" stroke={INK} strokeWidth={1.2} />
          <rect x={16} y={28} width={8} height={14} fill={INK} />
          {o.v >= 1 && <rect x={6} y={21} width={7} height={7} fill="#FFF4C2" stroke={INK} strokeWidth={1} />}
          {o.v >= 2 && <rect x={27} y={21} width={7} height={7} fill="#FFF4C2" stroke={INK} strokeWidth={1} />}
        </g>
      );
    case "tree":
      return (
        <g transform={t}>
          <rect x={11} y={28} width={6} height={18} fill="#7A4A2A" />
          {o.v === 0 ? <circle cx={14} cy={16} r={14} fill={o.color} /> : <polygon points="14,0 28,32 0,32" fill={o.color} />}
        </g>
      );
    case "flower": {
      const petals = 4 + o.v;
      return (
        <g transform={t}>
          <rect x={6.2} y={12} width={1.6} height={12} fill="#2E7D32" />
          {Array.from({ length: petals }, (_, k) => {
            const a = (k / petals) * Math.PI * 2;
            return <circle key={k} cx={7 + Math.cos(a) * 4.5} cy={7 + Math.sin(a) * 4.5} r={3} fill={o.color} />;
          })}
          <circle cx={7} cy={7} r={2.4} fill="#FFD23F" stroke={INK} strokeWidth={0.6} />
        </g>
      );
    }
  }
}

function Picture({ scene }: { scene: Scene }) {
  return (
    <>
      <rect width={W} height={H} fill={scene.sky} />
      {scene.hills.map((h, k) => (
        <ellipse key={k} cx={h.x + h.w / 2} cy={120} rx={h.w / 2} ry={h.h} fill={h.color} />
      ))}
      <rect y={120} width={W} height={H - 120} fill={scene.ground} />
      {scene.objs.map((o) => (
        <Thing key={o.id} o={o} />
      ))}
    </>
  );
}

/**
 * Squint board: two pictures, stacked. Tap a difference in either picture to ring it in both.
 * Keyboard: a 6 × 4 grid over the lower picture; Enter checks the focused patch.
 */
export default function SquintBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<SquintPuzzle, SquintState>) {
  const diffs = useMemo(() => differences(puzzle), [puzzle]);
  const regions = useMemo(() => Object.fromEntries(diffs.map((id) => [id, regionOf(puzzle, id)])), [diffs, puzzle]);
  const [found, setFound] = useState<string[]>(() => initialState?.found.slice() ?? []);
  const [misses, setMisses] = useState(initialState?.misses ?? 0);
  const [miss, setMiss] = useState<{ x: number; y: number; pic: number; n: number } | null>(null);
  const [last, setLast] = useState<{ id: string; n: number } | null>(null);
  const [done, setDone] = useState(false);
  const ref = useRef({ found, misses });
  const [width, setWidth] = useState(358);
  useEffect(() => {
    const on = () => setWidth(Math.min(358, window.innerWidth - 36));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const scale = width / W;
  const ph = Math.round(H * scale);
  const total = diffs.length;

  /** Check a point in scene units, from either picture. */
  const check = useCallback(
    (x: number, y: number, pic: number, box?: Box) => {
      if (disabled || done) return;
      const cur = ref.current;
      const hitId = diffs.find((id) => {
        if (cur.found.includes(id)) return false;
        const r = regions[id];
        if (box) return r.x < box.x + box.w && box.x < r.x + r.w && r.y < box.y + box.h && box.y < r.y + r.h;
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      });
      const already =
        !hitId &&
        diffs.some((id) => {
          const r = regions[id];
          return cur.found.includes(id) && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
        });
      if (already) {
        api.feedback("Already found that one.", "info", "eye");
        return;
      }
      if (!hitId) {
        const next = { found: cur.found, misses: cur.misses + 1 };
        ref.current = next;
        setMisses(next.misses);
        setMiss((m) => ({ x, y, pic, n: (m?.n ?? 0) + 1 }));
        api.ruleBreak("Nothing different there.");
        api.onMove(next, { mistake: true, correctStreak: 0 });
        return;
      }
      const next = { found: [...cur.found, hitId], misses: cur.misses };
      ref.current = next;
      setFound(next.found);
      setLast((l) => ({ id: hitId, n: (l?.n ?? 0) + 1 }));
      const clear = next.found.length === total;
      if (clear) {
        setDone(true);
        play("jingle");
        api.feedback("Sharp eyes. Every difference found.", "success", "check-circle");
        api.announce("All differences found.");
      } else {
        play("pop", { step: next.found.length });
        api.feedback(
          mode === "tutorial" && next.found.length === 1
            ? "Found one. Rings show in both pictures."
            : `${next.found.length} of ${total} found`,
          "info",
          "eye",
        );
        api.announce(`Difference found. ${next.found.length} of ${total}.`);
      }
      api.onMove(next, { correctStreak: next.found.length });
      if (clear) api.onSolved(next);
    },
    [api, diffs, disabled, done, mode, regions, total],
  );

  useEffect(() => {
    api.setControls([{ id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" }]);
  }, [api]);
  useEffect(() => {
    api.feedback(
      mode === "tutorial" ? "Tap anything that is different in the second picture." : `0 of ${total} found`,
      "info",
      mode === "tutorial" ? "hand-pointing" : "eye",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cw = W / COLS,
    ch = H / ROWS;
  const keys = useGridKeys(ROWS, COLS, (i) => {
    const r = Math.floor(i / COLS),
      c = i % COLS;
    check(c * cw + cw / 2, r * ch + ch / 2, 1, { x: c * cw, y: r * ch, w: cw, h: ch });
  });

  const onTap = (pic: number) => (e: PointerEvent<SVGSVGElement>) => {
    if (e.button > 0) return;
    const b = e.currentTarget.getBoundingClientRect();
    check(((e.clientX - b.left) / b.width) * W, ((e.clientY - b.top) / b.height) * H, pic);
  };

  const hintBox = hint?.target && typeof hint.target === "object" && "w" in (hint.target as Box) ? (hint.target as Box) : null;

  const rings = (pic: number) => (
    <>
      {found.map((id) => {
        const r = regions[id];
        const isLast = last?.id === id;
        return (
          <g
            key={id}
            className={isLast ? (last!.n % 2 ? "cell-pop-a" : "cell-pop-b") : ""}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <ellipse cx={r.x + r.w / 2} cy={r.y + r.h / 2} rx={r.w / 2 + 2} ry={r.h / 2 + 2} fill="none" stroke={INK} strokeWidth={5} />
            <ellipse
              cx={r.x + r.w / 2}
              cy={r.y + r.h / 2}
              rx={r.w / 2 + 2}
              ry={r.h / 2 + 2}
              fill="none"
              stroke="var(--world)"
              strokeWidth={3}
            />
          </g>
        );
      })}
      {hintBox && !done && (
        <rect
          className="hint-ring"
          x={hintBox.x}
          y={hintBox.y}
          width={hintBox.w}
          height={hintBox.h}
          rx={10}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={3}
          strokeDasharray="6 4"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      )}
      {miss && miss.pic === pic && (
        <g
          key={miss.n}
          className={miss.n % 2 ? "cell-shake-a" : "cell-shake-b"}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <circle
            cx={miss.x}
            cy={miss.y}
            r={11}
            fill="var(--danger)"
            stroke={INK}
            strokeWidth={2}
            style={{ animation: "fade-in 400ms var(--ease-out) reverse 700ms both" }}
          />
          <path
            d={`M${miss.x - 4} ${miss.y - 4} L${miss.x + 4} ${miss.y + 4} M${miss.x + 4} ${miss.y - 4} L${miss.x - 4} ${miss.y + 4}`}
            stroke={INK}
            strokeWidth={2.4}
            strokeLinecap="round"
            style={{ animation: "fade-in 400ms var(--ease-out) reverse 700ms both" }}
          />
        </g>
      )}
    </>
  );

  const lastR = last ? regions[last.id] : null;
  const lastCell = lastR ? [Math.floor((lastR.y + lastR.h / 2) / ch), Math.floor((lastR.x + lastR.w / 2) / cw)] : [0, 0];

  return (
    <div className={`flex flex-col gap-2.5 ${done ? "board-pulse" : ""}`} style={{ width }}>
      {[puzzle.a, puzzle.b].map((scene, pic) => (
        <div
          key={pic}
          className="relative overflow-hidden rounded-[18px]"
          style={{ height: ph, boxShadow: "0 0 0 2px var(--line)", perspective: 600 }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={width}
            height={ph}
            className="block cursor-pointer touch-manipulation"
            onPointerDown={onTap(pic)}
            role="img"
            aria-label={pic === 0 ? "Picture one" : "Picture two"}
          >
            <Picture scene={scene} />
            {rings(pic)}
          </svg>
          <span
            className="num pointer-events-none absolute top-2 left-2 flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[13px] font-bold"
            style={{ background: "#0E0F1A", color: "#F4F5FB" }}
          >
            {pic + 1}
          </span>
          {pic === 1 && (
            <div
              role="grid"
              aria-label={`Picture two in a ${COLS} by ${ROWS} grid. Enter checks a patch.`}
              aria-rowcount={ROWS}
              aria-colcount={COLS}
              onKeyDown={keys.onKeyDown}
              className="pointer-events-none absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
            >
              {Array.from({ length: ROWS }, (_, r) => (
                <div role="row" key={r} className="contents">
                  {Array.from({ length: COLS }, (_, c) => {
                    const i = r * COLS + c;
                    const dist = Math.abs(r - lastCell[0]) + Math.abs(c - lastCell[1]);
                    return (
                      <div
                        key={i}
                        role="gridcell"
                        data-i={i}
                        tabIndex={keys.focus === i ? 0 : -1}
                        aria-label={`Row ${r + 1}, column ${c + 1}`}
                        className="relative rounded-[6px] outline-none"
                      >
                        {done && (
                          <span
                            aria-hidden
                            className="absolute inset-0"
                            style={{
                              background: "var(--world)",
                              opacity: 0.28,
                              animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both`,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="flex items-center justify-center gap-1.5" aria-label={`${found.length} of ${total} found, ${misses} misses`}>
        {diffs.map((id, k) => (
          <span
            key={id}
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ background: k < found.length ? "var(--world)" : "var(--surface-raised)", color: INK }}
          >
            {k < found.length && <Icon name="check" size={14} />}
          </span>
        ))}
      </div>
    </div>
  );
}
