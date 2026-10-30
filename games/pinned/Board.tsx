"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { BoardProps } from "@/games/types";
import { play } from "@/lib/audio";
import { unseal } from "@/games/_shared/cluecave";
import { LAND, ringPath, VIEWS, WATER, type MapView } from "./geo";
import { distanceKm, pointsFor, sealKey, type LatLon, type PinnedPuzzle, type PinnedState } from "./logic";

const INK = "#0E0F1A";
type Box = { x: number; y: number; w: number; h: number };
type Phase = "place" | "reveal" | "done";

const full = (v: MapView): Box => ({ x: v.west, y: -v.north, w: v.east - v.west, h: v.north - v.south });
const clampBox = (b: Box, v: MapView): Box => {
  const f = full(v);
  const w = Math.min(b.w, f.w),
    h = Math.min(b.h, f.h);
  return { w, h, x: Math.min(Math.max(b.x, f.x), f.x + f.w - w), y: Math.min(Math.max(b.y, f.y), f.y + f.h - h) };
};
const fmt = (lat: number, lon: number) =>
  `${Math.abs(Math.round(lat))} ${lat >= 0 ? "north" : "south"}, ${Math.abs(Math.round(lon))} ${lon >= 0 ? "east" : "west"}`;
const km = (d: number) => `${Math.round(d).toLocaleString("en-GB")} km`;

/**
 * Pinned board. A hand drawn equirectangular map (world or Africa). Tap once to zoom in where you
 * tapped, then tap to drop the pin; drag to pan while zoomed. Arrow keys nudge the pin, + and -
 * zoom, Enter locks. After locking, the true spot appears with a dashed line and the distance.
 */
export default function PinnedBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<PinnedPuzzle, PinnedState>) {
  const spots = useMemo(() => unseal<LatLon[]>(puzzle.sealed, sealKey(puzzle.ref)), [puzzle]);
  const total = puzzle.rounds.length;
  const [pins, setPins] = useState<(LatLon | null)[]>(() => initialState?.pins ?? []);
  const [phase, setPhase] = useState<Phase>(() => ((initialState?.pins.length ?? 0) >= total ? "done" : "place"));
  const i = phase === "place" ? pins.length : Math.max(0, pins.length - 1);
  const round = puzzle.rounds[Math.min(i, total - 1)];
  const view = VIEWS[round.map];
  const [box, setBox] = useState<Box>(() => full(view));
  const [pin, setPin] = useState<LatLon | null>(null);
  const [px, setPx] = useState(330);
  const [dropN, setDropN] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; box: Box; moved: boolean } | null>(null);
  const pinsRef = useRef(pins);

  useEffect(() => {
    const on = () => setPx(wrap.current?.clientWidth || 330);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const f = full(view);
  const zoomed = box.w < f.w - 0.01;
  const k = box.w / px; // view units per screen pixel
  const height = (px * f.h) / f.w;

  const toLatLon = (clientX: number, clientY: number): LatLon | null => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [Math.max(view.south, Math.min(view.north, -p.y)), Math.max(view.west, Math.min(view.east, p.x))];
  };

  const zoomAt = useCallback(
    (lat: number, lon: number, factor: number) => {
      setBox((b) => {
        const w = Math.max(f.w / (view.zoom * 2), Math.min(f.w, b.w / factor));
        const h = (w * f.h) / f.w;
        return clampBox({ x: lon - w / 2, y: -lat - h / 2, w, h }, view);
      });
    },
    [f.h, f.w, view],
  );

  const place = useCallback(
    (ll: LatLon) => {
      setPin(ll);
      setDropN((n) => n + 1);
      play("pop", { step: 2 });
      api.announce(`Pin at ${fmt(ll[0], ll[1])}`);
    },
    [api],
  );

  const lock = useCallback(() => {
    if (disabled || phase !== "place" || !pin) return;
    const next = [...pinsRef.current, pin];
    pinsRef.current = next;
    setPins(next);
    setPhase("reveal");
    const d = distanceKm(pin, spots[next.length - 1]);
    const pts = pointsFor(d, round.map);
    api.onMove({ pins: next }, { correctStreak: pts > 500 ? 1 : 0 });
    play(pts >= 700 ? "chime" : "tick", { step: Math.round(pts / 150) });
    api.feedback(`${km(d)} away. ${pts} points.`, pts >= 500 ? "success" : "info", "map-pin");
    api.announce(`${round.name} was ${km(d)} from your pin. ${pts} points.`);
    // Frame both points
    const [a, b] = [pin, spots[next.length - 1]];
    const w0 = Math.max(Math.abs(a[1] - b[1]) * 1.6, f.w / view.zoom);
    const h0 = Math.max(Math.abs(a[0] - b[0]) * 1.6, f.h / view.zoom);
    const w = Math.min(f.w, Math.max(w0, (h0 * f.w) / f.h));
    const h = (w * f.h) / f.w;
    setBox(clampBox({ x: (a[1] + b[1]) / 2 - w / 2, y: -(a[0] + b[0]) / 2 - h / 2, w, h }, view));
  }, [api, disabled, f.h, f.w, phase, pin, round, spots, view]);

  const next = useCallback(() => {
    if (phase !== "reveal") return;
    const done = pinsRef.current.length >= total;
    if (done) {
      setPhase("done");
      const totalPts = pinsRef.current.reduce((s, p, j) => s + (p ? pointsFor(distanceKm(p, spots[j]), puzzle.rounds[j].map) : 0), 0);
      play("jingle");
      api.feedback(`All ${total} pinned. Score ${totalPts}.`, "success", "check-circle");
      api.onSolved({ pins: pinsRef.current });
      return;
    }
    const nv = VIEWS[puzzle.rounds[pinsRef.current.length].map];
    setPin(null);
    setBox(full(nv));
    setPhase("place");
    const r = puzzle.rounds[pinsRef.current.length];
    api.feedback(`Round ${pinsRef.current.length + 1}: ${r.name}. Tap the map to zoom in.`, "info", "map-pin");
    api.announce(`Round ${pinsRef.current.length + 1}. ${r.name}. ${r.line}`);
  }, [api, phase, puzzle.rounds, spots, total]);

  useEffect(() => {
    api.setControls([
      {
        id: "zoom",
        label: "Zoom out",
        icon: "arrows-out-cardinal",
        onPress: () => setBox(full(view)),
        disabled: disabled || !zoomed || phase === "done",
      },
      phase === "place"
        ? { id: "lock", label: "Lock pin", icon: "map-pin", onPress: lock, tone: pin ? "world" : "default", disabled: disabled || !pin }
        : {
            id: "next",
            label: phase === "done" ? "Done" : pins.length >= total ? "Finish" : "Next",
            icon: phase === "done" ? "flag-checkered" : "arrow-right",
            onPress: next,
            tone: phase === "reveal" ? "world" : "default",
            disabled: disabled || phase === "done",
          },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold", disabled: phase !== "place" },
    ]);
  }, [api, disabled, lock, next, phase, pin, pins.length, total, view, zoomed]);

  useEffect(() => {
    api.feedback(
      mode === "tutorial"
        ? "Tap the map to zoom in, then tap again to drop your pin."
        : "Tap the map to zoom in, then tap to drop the pin.",
      "info",
      "hand-pointing",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (disabled || phase !== "place") return;
    drag.current = { x: e.clientX, y: e.clientY, box, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || !zoomed) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    setBox(clampBox({ ...d.box, x: d.box.x - dx * k, y: d.box.y - dy * k }, view));
  };
  const onUp = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved || disabled || phase !== "place") return;
    const ll = toLatLon(e.clientX, e.clientY);
    if (!ll) return;
    if (!zoomed) {
      zoomAt(ll[0], ll[1], view.zoom);
      play("tick");
      api.feedback("Zoomed in. Tap to drop the pin, drag to look around.", "info", "map-pin");
      return;
    }
    place(ll);
  };

  const onKey = (e: KeyboardEvent) => {
    if (disabled || phase !== "place") return;
    const step = (e.shiftKey ? 4 : 1) * (box.w / 40);
    const cur: LatLon = pin ?? [-(box.y + box.h / 2), box.x + box.w / 2];
    const mv: Record<string, [number, number]> = {
      ArrowUp: [step, 0],
      ArrowDown: [-step, 0],
      ArrowLeft: [0, -step],
      ArrowRight: [0, step],
    };
    if (mv[e.key]) {
      e.preventDefault();
      const ll: LatLon = [
        Math.max(view.south, Math.min(view.north, cur[0] + mv[e.key][0])),
        Math.max(view.west, Math.min(view.east, cur[1] + mv[e.key][1])),
      ];
      place(ll);
      if (zoomed && (ll[1] < box.x || ll[1] > box.x + box.w || -ll[0] < box.y || -ll[0] > box.y + box.h)) zoomAt(ll[0], ll[1], 1);
    } else if (e.key === "+" || e.key === "=") zoomAt(cur[0], cur[1], view.zoom);
    else if (e.key === "-") setBox(full(view));
    else if (e.key === "Enter") {
      e.preventDefault();
      lock();
    }
  };

  const shown = phase === "place" ? pin : pins[i];
  const truth = phase !== "place" ? spots[i] : null;
  const hintBox =
    phase === "place" && hint && typeof hint.target === "object" && (hint.target as { question: number }).question === i
      ? (hint.target as { box: number[] }).box
      : null;
  const pinShape = "M0 0C-5 -7 -9 -11 -9 -17A9 9 0 1 1 9 -17C9 -11 5 -7 0 0Z";

  return (
    <div className="flex w-[min(358px,calc(100vw-36px))] flex-col gap-3 rounded-[20px] p-3" style={{ background: "var(--board-bg)" }}>
      <div className="flex flex-col gap-1 rounded-[16px] px-3.5 py-3" style={{ background: "var(--surface)" }}>
        <div className="flex items-center gap-2">
          <div className="flex gap-[5px]" role="img" aria-label={`Round ${i + 1} of ${total}`}>
            {Array.from({ length: total }, (_, j) => (
              <span
                key={j}
                className="h-3 w-3 rounded-[4px]"
                style={{
                  background:
                    j < pins.length
                      ? "var(--world)"
                      : j === i
                        ? "var(--text)"
                        : "color-mix(in srgb, var(--text-muted) 30%, var(--surface))",
                }}
              />
            ))}
          </div>
          <span className="flex-1" />
          <span className="text-muted text-[12px] font-semibold tracking-[.08em] uppercase">
            {round.map === "world" ? "World map" : "Africa map"}
          </span>
        </div>
        <h2 className="font-display m-0 text-[20px] leading-tight font-black">{round.name}</h2>
        <p className="text-muted m-0 text-[15px] leading-[1.35]">{round.line}</p>
      </div>

      <div ref={wrap} className="relative overflow-hidden rounded-[14px]" style={{ height }}>
        <svg
          ref={svg}
          tabIndex={0}
          role="application"
          aria-label={`${round.map === "world" ? "World" : "Africa"} map. ${shown ? `Pin at ${fmt(shown[0], shown[1])}.` : "No pin yet."} Arrow keys move the pin, plus and minus zoom, Enter locks.`}
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          width={px}
          height={height}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onKey}
          className="block outline-none"
          style={{
            background: "var(--surface)",
            touchAction: zoomed ? "none" : "manipulation",
            cursor: phase === "place" ? (zoomed ? "crosshair" : "zoom-in") : "default",
          }}
        >
          <g
            fill="color-mix(in srgb, var(--world) 20%, var(--surface-raised))"
            stroke="color-mix(in srgb, var(--world) 45%, transparent)"
            strokeWidth={1}
            strokeLinejoin="round"
          >
            {LAND.map((r, j) => (
              <path key={j} d={ringPath(r)} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          <g fill="var(--surface)">
            {WATER.map((r, j) => (
              <path key={j} d={ringPath(r)} />
            ))}
          </g>
          <g stroke="var(--text-muted)" strokeOpacity={0.25} strokeDasharray="3 4" strokeWidth={1}>
            <line x1={view.west} x2={view.east} y1={0} y2={0} vectorEffect="non-scaling-stroke" />
            <line x1={0} x2={0} y1={-view.north} y2={-view.south} vectorEffect="non-scaling-stroke" />
          </g>
          {hintBox && (
            <rect
              x={hintBox[1]}
              y={-hintBox[2]}
              width={hintBox[3] - hintBox[1]}
              height={hintBox[2] - hintBox[0]}
              fill="color-mix(in srgb, var(--gold) 12%, transparent)"
              stroke="var(--gold)"
              strokeWidth={2}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
              className="hint-ring"
            />
          )}
          {shown && truth && (
            <line
              x1={shown[1]}
              y1={-shown[0]}
              x2={truth[1]}
              y2={-truth[0]}
              stroke="var(--text)"
              strokeWidth={2}
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {truth && (
            <g transform={`translate(${truth[1]} ${-truth[0]}) scale(${k})`} aria-hidden>
              <circle r={10} fill="var(--gold)" stroke={INK} strokeWidth={2} />
              <path d="M0 -6L1.8 -1.9L6 -1.9L2.6 0.8L3.8 5L0 2.5L-3.8 5L-2.6 0.8L-6 -1.9L-1.8 -1.9Z" fill={INK} />
            </g>
          )}
          {shown && (
            <g transform={`translate(${shown[1]} ${-shown[0]}) scale(${k})`} aria-hidden>
              <g className={dropN % 2 ? "cell-pop-a" : "cell-pop-b"} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}>
                <path d={pinShape} fill="var(--world)" stroke={INK} strokeWidth={2} />
                <circle cy={-17} r={3.5} fill={INK} />
              </g>
            </g>
          )}
        </svg>
      </div>
      {phase !== "place" && shown && truth && (
        <div className="flex items-center justify-between px-1 text-[14px] font-medium" aria-hidden>
          <span className="text-muted">{km(distanceKm(shown, truth))} away</span>
          <span className="num font-mono font-semibold">{pointsFor(distanceKm(shown, truth), round.map)} pts</span>
        </div>
      )}
    </div>
  );
}
