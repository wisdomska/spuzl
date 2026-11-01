"use client";

/**
 * Shared Rage Ridge board: a Phaser canvas sized to the board slot, the in-canvas HUD (Game Boards:
 * Gotcha and Dash, Overlays: GR Ghost Race), touch controls under the board (D-pad 64 px, jump 96 px),
 * keyboard (arrows, A D, Space, W) and the Gamepad API. Phaser is imported inside an effect so it lands
 * in its own lazy chunk; until it draws, the CSS poster frame (night scene) shows under the canvas.
 * The simulation is fixed-step and every frame's buttons go into the input log; held keys and pointers
 * keep applying on every step until released (HeldInput).
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
} from "react";
import type { BoardProps, InputLog } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { formatClock } from "@/lib/format";
import { prefersReducedMotion, useSettings } from "@/lib/settings/store";
import { buildGhost, RageController } from "./controller";
import { EV, type SimCore } from "./sim/core";
import type { CoursePuzzle, RageState } from "./sim/course";
import { BTN } from "./sim/input";
import { framesToMs } from "./sim/fixed";
import { cssColor, type Painter } from "./render/types";
import type { Stage } from "./scene";
import { HeldInput } from "./held";
import { MIN_STAGE_HEIGHT, SHORT_VIEWPORT, stageHeight } from "./layout";
import { useFitHeight } from "@/components/game/useBoardSize";
import { posterStyle } from "./RagePoster";

export type ControlsKind = "dpad" | "tap" | "hold" | "lr" | "drag";

export interface RageGameSpec<S extends SimCore> {
  name: string;
  createSim(p: CoursePuzzle): S;
  painter(): Painter<S>;
  controls: ControlsKind;
  /** label on the big round button */
  action?: string;
  /** "deaths" (Gotcha), "distance" (Dash), "race" (Ghosted, GR Ghost Race panel), "score" (Ricochet, Stacked) */
  hud: "deaths" | "distance" | "score" | "race";
  /** level name for the caption under the board */
  levelName?(sim: S): string;
  metres?(sim: S): number;
  /** start copy */
  startHint: string;
  /** dev fixtures: a scripted run of this course (ghost=demo, autoplay=1) */
  demoLog?(p: CoursePuzzle): Promise<InputLog>;
  /** taller canvas (Flipside shows floor and ceiling, Slip climbs) */
  tall?: boolean;
  /** death copy override: lines (cycled by count) and noun ("Fall" for Wobble) */
  deathLines?: readonly string[];
  deathNoun?: string;
  /** a server hint arrived for the current level (reveal its traps) */
  reveal?(sim: S): void;
  /** shown in the feedback line once the run ends */
  finishCopy?(sim: S, timeMs: number): string;
}

export interface GhostSpec {
  name: string;
  log: InputLog;
}

const DEATH_LINES = ["Spuz has seen worse. Barely.", "Shake it off. Go again.", "Now you know. Go again.", "Spuz believes in you. Mostly."];
export function deathCopy(n: number, lines: readonly string[] = DEATH_LINES, noun = "Death") {
  return `${noun} number ${n}. ${lines[n % lines.length]}`;
}

const SEEN_KEY = "spuzl.photosensitive.seen";
const chip: CSSProperties = {
  whiteSpace: "nowrap",
  height: 40,
  padding: "0 12px",
  borderRadius: 12,
  background: "#0E0F1A",
  color: "#F4F5FB",
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const mono: CSSProperties = {
  fontFamily: "var(--font-mono, 'Geist Mono'), monospace",
  fontWeight: 600,
  fontSize: 18,
  fontVariantNumeric: "tabular-nums",
};

interface Hud {
  deaths: number;
  metres: number;
  score: number;
  progress: number;
  ghostProgress: number;
  delta: number | null;
  level: string;
  cleared: number;
  started: boolean;
  finished: boolean;
}

export function RageBoard<S extends SimCore>({
  puzzle,
  initialState,
  disabled,
  api,
  spec,
  ghost,
  hint,
}: BoardProps<CoursePuzzle, RageState> & { spec: RageGameSpec<S>; ghost?: GhostSpec | null }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const settings = useSettings();
  const reduced = prefersReducedMotion(settings);
  const reducedRef = useRef(reduced);
  // First render already uses the phone height (boards are client-only), so the poster never jumps.
  const [size, setSize] = useState(() => {
    const w = typeof window === "undefined" ? 354 : Math.max(0, Math.min(window.innerWidth, 560) - 36);
    const vp = typeof window === "undefined" ? { w: 1280, h: 800 } : { w: window.innerWidth, h: window.innerHeight };
    return { w, h: stageHeight(w, vp, spec.tall), short: vp.h < SHORT_VIEWPORT };
  });
  // The canvas gives up height (to MIN_STAGE_HEIGHT) until the controls under it and the shell fit the screen.
  const stageH = useFitHeight(size.h, Math.min(size.h, MIN_STAGE_HEIGHT), 1);
  const [bump, setBump] = useState(0);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState(() => {
    try {
      return !localStorage.getItem(SEEN_KEY);
    } catch {
      return true;
    }
  });
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
    reducedRef.current = reduced;
  });

  const ctl = useMemo(() => {
    const c = new RageController<S>(spec.createSim(puzzle));
    if (initialState?.log) c.restore(initialState.log);
    if (ghost) c.setGhost(buildGhost(ghost.name, () => spec.createSim(puzzle), ghost.log));
    return c;
    // the puzzle is fixed for the life of this board (the shell remounts on a new puzzle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const painter = useMemo(() => spec.painter(), [spec]);

  const stateNow = useCallback((): RageState => {
    const s: RageState = { log: ctl.log(), deaths: ctl.sim.deaths, timeMs: ctl.timeMs(), level: ctl.sim.cleared() };
    if (spec.hud === "score") s.score = ctl.sim.score();
    return s;
  }, [ctl, spec.hud]);

  const readHud = useCallback(
    (): Hud => ({
      deaths: ctl.sim.deaths,
      metres: spec.metres?.(ctl.sim) ?? 0,
      score: ctl.sim.score(),
      progress: ctl.sim.progress(),
      ghostProgress: ctl.ghost ? ctl.ghost.curve[Math.min(ctl.ghost.curve.length - 1, ctl.ghost.sim.frame)] : 0,
      delta: ctl.ghostDelta(),
      level: spec.levelName?.(ctl.sim) ?? "",
      cleared: ctl.sim.cleared(),
      started: ctl.started,
      finished: ctl.sim.finished,
    }),
    [ctl, spec],
  );
  const [hud, setHud] = useState<Hud>(readHud);

  // Sim events: sound, motion hooks, shell reports.
  useEffect(() => {
    const race = { behind: (ctl.ghostDelta() ?? -1) > 0 };
    ctl.setHooks({
      onStart: () => {
        apiRef.current.onMove(stateNow());
        setHud(readHud());
      },
      onEvents: (ev) => {
        const now = performance.now();
        painter.onEvents(ev, ctl.sim, now);
        if (ev & EV.DEATH) {
          play("splat");
          const n = ctl.sim.deaths;
          const line = deathCopy(n, spec.deathLines, spec.deathNoun);
          setBump((b) => b + 1);
          setMessage(line);
          apiRef.current.onMove(stateNow(), { mistake: true });
          apiRef.current.announce(line);
          if ((wrapRef.current?.clientWidth ?? 0) < 520) apiRef.current.feedback(line, "danger", "skull");
        }
        if (ev & EV.JUMP) play("jump");
        if (ev & EV.FLIP) play("hop");
        if (ev & EV.LAND) play("land");
        if (ev & EV.TRAP) play("spike");
        if (ev & EV.EXIT_RUN) play("whoosh");
        if (ev & EV.GRAB) play("tick");
        if (ev & EV.BOUNCE) play("pop", { step: Math.min(7, ctl.sim.score() % 8) });
        if (ev & EV.PLACE) play("clack");
        if (ev & EV.CUT) play("fizzle");
        if (ev & EV.PERFECT) play("chime", { step: ctl.sim.score() % 8 });
        if (ev & EV.CHECKPOINT) play("check");
        if (ev & EV.CLEAR && !(ev & EV.FINISH)) {
          play("chime", { step: ctl.sim.cleared() });
          const total = puzzle.levels.length;
          const txt = `Level ${ctl.sim.cleared()} of ${total} cleared.`;
          apiRef.current.onMove(stateNow());
          apiRef.current.announce(txt);
          apiRef.current.feedback(txt, "info", "flag-checkered");
        }
        const d = ctl.ghostDelta();
        if (d !== null) {
          const behind = d > 0;
          if (race.behind && !behind) play("swoosh");
          race.behind = behind;
        }
      },
      onFinish: () => {
        play("jingle");
        const st = stateNow();
        const copy = spec.finishCopy?.(ctl.sim, st.timeMs) ?? `Course cleared with ${st.deaths} ${st.deaths === 1 ? "death" : "deaths"}.`;
        apiRef.current.feedback(copy, "success", "flag-checkered");
        apiRef.current.announce(copy);
        setHud(readHud());
        apiRef.current.onSolved(st);
      },
    });
  }, [ctl, painter, puzzle.levels.length, readHud, spec, stateNow]);

  useEffect(() => {
    const t = hint?.target as { level?: number } | undefined;
    if (t && t.level === ctl.sim.cleared()) spec.reveal?.(ctl.sim);
  }, [ctl, hint, spec]);

  useEffect(() => {
    ctl.setPaused(!!disabled && !ctl.sim.finished);
  }, [ctl, disabled]);

  // The shell timer shows the simulation clock (fixed steps), which is the time the server replays and scores.
  // It is the only clock on screen: the in-canvas HUD carries deaths, score, distance and the ghost read.
  useEffect(() => {
    api.setClock?.(() => ctl.timeMs());
    return () => api.setClock?.(null);
  }, [api, ctl]);

  // Dev fixture: ?ghost=demo races a scripted ghost, ?autoplay=1 plays the scripted run.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !spec.demoLog) return;
    const q = new URLSearchParams(window.location.search);
    if (!q.get("ghost") && !q.get("autoplay")) return;
    void spec.demoLog(puzzle).then((log) => {
      if (q.get("ghost") && !ctl.ghost)
        ctl.setGhost(buildGhost(q.get("ghost") === "demo" ? "Kofi" : q.get("ghost")!, () => spec.createSim(puzzle), log));
      if (q.get("autoplay")) ctl.playDemo(log);
    });
  }, [ctl, puzzle, spec]);

  // No shell controls: the action controls live under the canvas.
  useEffect(() => {
    api.setControls([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // HUD refresh at 10 Hz.
  useEffect(() => {
    const id = setInterval(() => setHud(readHud()), 100);
    return () => clearInterval(id);
  }, [readHud]);

  // Size the canvas to the board slot (and, on phones, to the viewport height) before the first paint.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const on = () => {
      const w = Math.floor(el.clientWidth);
      const h = stageHeight(w, { w: window.innerWidth, h: window.innerHeight }, spec.tall);
      const short = window.innerHeight < SHORT_VIEWPORT;
      setSize((s) => (s.w === w && s.h === h && s.short === short ? s : { w, h, short }));
    };
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    window.addEventListener("resize", on);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", on);
    };
  }, [spec.tall]);

  // Lazy Phaser.
  const stageRef = useRef<Stage | null>(null);
  const sizeRef = useRef({ w: size.w, h: stageH });
  useEffect(() => {
    sizeRef.current = { w: size.w, h: stageH };
  }, [size.w, stageH]);
  useEffect(() => {
    let dead = false;
    void (async () => {
      const [mod, { startStage }] = await Promise.all([import("phaser"), import("./scene")]);
      if (dead || !canvasRef.current) return;
      const Phaser = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
      const css = getComputedStyle(canvasRef.current);
      const palette = {
        rage: cssColor(css.getPropertyValue("--w-rage"), 0xff3b3b),
        gold: 0xffc93c,
        accent: 0xb8f23a,
      };
      stageRef.current = startStage(Phaser, {
        parent: canvasRef.current,
        width: sizeRef.current.w,
        height: sizeRef.current.h,
        painter,
        palette,
        reduced: () => reducedRef.current,
        frame: (dt) => {
          pollGamepad(ctl);
          ctl.tick(dt);
          return { sim: ctl.sim, ghost: ctl.ghost ? { sim: ctl.ghost.sim, name: ctl.ghost.name } : null };
        },
      });
    })();
    return () => {
      dead = true;
      stageRef.current?.destroy();
      stageRef.current = null;
    };
  }, [ctl, painter]);
  useEffect(() => {
    stageRef.current?.resize(size.w, stageH);
  }, [size.w, stageH]);

  const dismissNotice = useCallback(() => {
    setNotice(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode */
    }
  }, []);

  const press = useCallback(
    (src: string, bits: number) => {
      if (notice) dismissNotice();
      ctl.setSource(src, bits);
    },
    [ctl, notice, dismissNotice],
  );

  // Held input: one tracker for the board's life, so a re-render (the photosensitive notice closing on the
  // first press) never forgets a key or finger that is still down. Presses go through `press`, releases
  // straight to the controller.
  const held = useMemo(() => new HeldInput(), []);
  useEffect(() => {
    held.setApply((src, bits, down) => (down ? press(src, bits) : ctl.setSource(src, bits)));
  }, [held, ctl, press]);

  // Keyboard: arrows or A D to move, Space, W or Up to jump. Auto-repeat re-applies; release on keyup,
  // window blur, a hidden tab or page hide.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (t && t.tagName === "BUTTON" && !t.dataset.rage && (e.code === "Space" || e.code === "Enter")) return;
      if (held.keyDown(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => held.keyUp(e.code);
    const releaseAll = () => held.releaseAll();
    const onVis = () => {
      if (document.hidden) releaseAll();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", releaseAll);
    window.addEventListener("pagehide", releaseAll);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", releaseAll);
      window.removeEventListener("pagehide", releaseAll);
      document.removeEventListener("visibilitychange", onVis);
      releaseAll();
    };
  }, [held]);

  // Canvas touch: tap anywhere to jump (tap and hold games), drag to swing (Slip). The pointer is captured
  // so a finger that slides off the canvas still releases.
  const drag = useRef<{ id: number; x: number } | null>(null);
  const onCanvasDown = (e: RPointerEvent) => {
    if (spec.controls !== "tap" && spec.controls !== "hold" && spec.controls !== "drag") return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    if (spec.controls === "drag") {
      drag.current = { id: e.pointerId, x: e.clientX };
      held.pointerDown("canvas", e.pointerId, 0);
    } else held.pointerDown("canvas", e.pointerId, BTN.JUMP);
  };
  const onCanvasMove = (e: RPointerEvent) => {
    if (spec.controls !== "drag" || !drag.current || drag.current.id !== e.pointerId) return;
    const dx = e.clientX - drag.current.x;
    held.pointerSet("canvas", e.pointerId, dx > 12 ? BTN.RIGHT : dx < -12 ? BTN.LEFT : 0);
    if (Math.abs(dx) > 48) drag.current.x = e.clientX - Math.sign(dx) * 48;
  };
  const onCanvasUp = (e: RPointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
    held.pointerUp("canvas", e.pointerId);
  };

  // On-screen controls: pressed while any pointer is down on them (captured, so sliding off keeps the
  // press); pointerup, pointercancel and lost capture all release.
  const holdProps = (src: string, bit: number) => {
    const release = (e: RPointerEvent) => held.pointerUp(src, e.pointerId);
    return {
      onPointerDown: (e: RPointerEvent) => {
        e.preventDefault();
        try {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        } catch {
          /* pointer already gone */
        }
        held.pointerDown(src, e.pointerId, bit);
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      "data-rage": "1",
    };
  };

  const wide = size.w >= 520;
  const ghostOn = !!ctl.ghost;
  const total = puzzle.levels.length;

  return (
    <div ref={wrapRef} className="flex w-full flex-col gap-3.5" style={{ maxWidth: "100%" }}>
      <div
        className="relative overflow-hidden rounded-[20px] select-none"
        style={{ ...posterStyle, height: stageH, touchAction: "none", WebkitTouchCallout: "none" }}
        onPointerDown={onCanvasDown}
        onPointerMove={onCanvasMove}
        onPointerUp={onCanvasUp}
        onPointerCancel={onCanvasUp}
        onLostPointerCapture={onCanvasUp}
      >
        <div ref={canvasRef} role="img" aria-label={`${spec.name} level. ${hud.deaths} deaths.`} className="absolute inset-0" />

        {/* HUD */}
        <div className="pointer-events-none absolute top-3 right-3.5 left-3.5 z-[2] flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              {(spec.hud === "distance" || spec.hud === "race") && (
                <div style={{ ...chip, ...mono }} aria-label={`${hud.metres} metres`}>
                  {hud.metres} m
                </div>
              )}
              {spec.hud === "score" ? (
                <div style={{ ...chip, ...mono }} aria-label={`Score ${hud.score}`}>
                  <Icon name="star" size={18} style={{ color: "var(--gold)" }} />
                  {hud.score}
                </div>
              ) : (
                <div
                  key={bump}
                  className={bump ? (bump % 2 ? "cell-pop-a" : "cell-pop-b") : ""}
                  style={{ ...chip, ...mono }}
                  aria-label={`${hud.deaths} deaths`}
                >
                  <Icon name="skull" size={18} style={{ color: "var(--w-rage)" }} />
                  {hud.deaths}
                </div>
              )}
            </div>
            {spec.hud !== "race" && ghostOn && hud.delta !== null ? (
              <div style={{ ...chip, fontSize: 15, fontWeight: 600, whiteSpace: "nowrap" }}>
                <Icon name="ghost" size={16} style={{ color: "#A2A6C2" }} />
                {Math.abs(hud.delta) < 0.05 ? (
                  `Level with ${ctl.ghost!.name}`
                ) : (
                  <>
                    {ctl.ghost!.name} is
                    <span style={{ ...mono, fontSize: 15, color: "#B8F23A" }}>{Math.abs(hud.delta).toFixed(1)} s</span>
                    {hud.delta > 0 ? "ahead" : "behind"}
                  </>
                )}
              </div>
            ) : (
              wide &&
              message && (
                <div style={{ ...chip, padding: "0 14px", fontSize: 14, fontWeight: 500 }} role="status">
                  {message}
                </div>
              )
            )}
          </div>
          {spec.hud === "distance" && <RaceBar progress={hud.progress} ghost={ghostOn ? hud.ghostProgress : null} />}
          {spec.hud === "race" && (
            <div className="flex flex-col gap-2.5 rounded-[16px] p-3" style={{ background: "#0E0F1A", color: "#F4F5FB" }}>
              <div className="flex items-center justify-between text-[14px] font-semibold">
                <span className="flex items-center gap-1.5">
                  <Icon name="ghost" size={16} />
                  {ghostOn
                    ? `vs ${ctl.ghost!.name}'s best, ${formatClock(framesToMs(ctl.ghost!.log.frames))}`
                    : "Your best run becomes the ghost"}
                </span>
                {ghostOn && hud.delta !== null && hud.started && (
                  <span
                    style={{ ...mono, fontSize: 14, color: hud.delta > 0 ? "var(--w-rage)" : "#B8F23A" }}
                    aria-label={
                      hud.delta > 0 ? `${Math.abs(hud.delta).toFixed(1)} seconds behind` : `${Math.abs(hud.delta).toFixed(1)} seconds ahead`
                    }
                  >
                    {hud.delta > 0 ? "+" : "\u2212"}
                    {Math.abs(hud.delta).toFixed(1)} s
                  </span>
                )}
              </div>
              <RaceBar progress={hud.progress} ghost={ghostOn ? hud.ghostProgress : null} />
            </div>
          )}
        </div>

        {(!hud.started || notice) && !hud.finished && (
          <div className="pointer-events-none absolute inset-x-4 top-[38%] z-[3] flex flex-col items-center gap-2 text-center">
            {notice && (
              <div
                style={{
                  ...chip,
                  height: "auto",
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: "#20233A",
                  whiteSpace: "normal",
                }}
              >
                <Icon name="warning-circle" size={16} style={{ color: "#FFC93C", flex: "none" }} />
                Fast motion and quick flashes ahead. Take a break whenever you like.
              </div>
            )}
            {!hud.started && <div style={{ ...chip, fontSize: 14, fontWeight: 600 }}>{spec.startHint}</div>}
          </div>
        )}
      </div>

      {/* Controls under the board */}
      <div className="flex items-center justify-between gap-2 select-none" style={{ WebkitTouchCallout: "none" }}>
        {spec.controls === "dpad" || spec.controls === "lr" || spec.controls === "drag" ? (
          <div className="flex flex-none gap-2">
            <PadButton label="Move left" icon="caret-left" small={size.short} {...holdProps("pl", BTN.LEFT)} />
            <PadButton label="Move right" icon="caret-right" small={size.short} {...holdProps("pr", BTN.RIGHT)} />
          </div>
        ) : (
          <span className="text-muted text-[14px] font-medium">or tap anywhere</span>
        )}
        <div className="text-muted min-w-0 flex-1 text-center text-[14px] leading-[1.4] font-medium" aria-live="off">
          {total > 1 && (
            <div className="num font-semibold text-balance text-[var(--text)]">{`Level ${Math.min(total, hud.cleared + 1)} of ${total}`}</div>
          )}
          {hud.level && <div className="truncate">{hud.level}</div>}
        </div>
        {spec.controls !== "lr" && (
          <button
            type="button"
            aria-label={spec.action ?? "Jump"}
            className="toy flex flex-none items-center justify-center rounded-full"
            style={{
              // 80 px on short screens (still well over 44), so the canvas keeps more of its height.
              width: size.short ? 80 : 96,
              height: size.short ? 80 : 96,
              background: "var(--w-rage)",
              color: "#0E0F1A",
              ["--btn-depth" as string]: "#8A1E1E",
              boxShadow: "0 7px 0 #8A1E1E",
              font: "900 16px var(--font-display, Unbounded), sans-serif",
              touchAction: "none",
            }}
            {...holdProps("pj", BTN.JUMP)}
          >
            {(spec.action ?? "Jump").toUpperCase()}
          </button>
        )}
      </div>
    </div>
  );
}

/** Course bar: lime fill, cyan player marker, translucent orange ghost marker (GR Ghost Race). */
function RaceBar({ progress, ghost }: { progress: number; ghost: number | null }) {
  return (
    <div className="relative h-2.5 rounded-[5px]" style={{ background: "#2B2F4A" }} aria-hidden>
      <div className="absolute inset-y-0 left-0 rounded-[5px]" style={{ width: `${progress * 100}%`, background: "#B8F23A" }} />
      {ghost !== null && (
        <div
          className="absolute -top-[5px] h-5 w-5 rounded-[7px]"
          style={{ left: `calc(${ghost * 100}% - 10px)`, background: "#FF8A3D", opacity: 0.6, boxShadow: "0 0 0 2px #0E0F1A" }}
        />
      )}
      <div
        className="absolute -top-[5px] h-5 w-5 rounded-[7px]"
        style={{ left: `calc(${progress * 100}% - 10px)`, background: "#2FD3E0", boxShadow: "0 0 0 2px #0E0F1A" }}
      />
    </div>
  );
}

function PadButton({ label, icon, small, ...rest }: { label: string; icon: string; small?: boolean } & Record<string, unknown>) {
  return (
    <button
      type="button"
      aria-label={label}
      className="toy flex items-center justify-center"
      style={{
        width: small ? 56 : 64,
        height: small ? 56 : 64,
        borderRadius: 20,
        background: "var(--surface-raised)",
        color: "var(--text)",
        ["--btn-depth" as string]: "var(--depth)",
        boxShadow: "0 6px 0 var(--depth)",
        touchAction: "none",
      }}
      {...rest}
    >
      <Icon name={icon} size={26} />
    </button>
  );
}

/** Standard-mapping gamepads: D-pad or left stick to move, A or B to jump. */
function pollGamepad(ctl: { sources: Record<string, number>; setSource(name: string, b: number): void }) {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return;
  let b = 0;
  for (const p of navigator.getGamepads()) {
    if (!p) continue;
    const btn = (i: number) => !!p.buttons[i]?.pressed;
    if (btn(14) || (p.axes[0] ?? 0) < -0.4) b |= BTN.LEFT;
    if (btn(15) || (p.axes[0] ?? 0) > 0.4) b |= BTN.RIGHT;
    if (btn(0) || btn(1) || btn(12)) b |= BTN.JUMP;
    if (btn(13)) b |= BTN.DOWN;
  }
  if (b !== (ctl.sources.pad ?? 0)) ctl.setSource("pad", b);
}
