/**
 * Boots a Phaser game that only renders: one Scene, one Graphics layer redrawn every frame by a
 * Painter, and pooled Text labels. The Phaser module is passed in by the Board after a dynamic
 * `import("phaser")`, so Phaser lives in its own lazy chunk and never in other routes.
 */
import type * as PhaserNS from "phaser";
import { DOT_STEP, SCENE, type DrawCtx, type LabelStyle, type Painter, type Palette } from "./render/types";

type PhaserModule = typeof PhaserNS;

/** Texture key of the backdrop tile (one dot on the scene colour). */
const DOTS_KEY = "rage-dots";
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
/** `n` mod `m`, never negative. */
const wrap = (n: number, m: number) => ((n % m) + m) % m;

export interface StageOptions<S> {
  parent: HTMLElement;
  width: number;
  height: number;
  painter: Painter<S>;
  /** called every animation frame with elapsed ms; returns what to draw */
  frame(dtMs: number): { sim: S; ghost: { sim: S; name: string } | null };
  palette: Palette;
  reduced(): boolean;
}

export interface Stage {
  resize(width: number, height: number): void;
  /**
   * Stops (false) or restarts (true) the render loop: the board is covered (Pause, the menu, a confirm), so nothing
   * on it is seen. The sim keeps no time of its own while asleep (the controller only steps on frames, and the shell
   * clock is the source of truth), so waking never jumps.
   */
  setAwake(awake: boolean): void;
  destroy(): void;
}

export function startStage<S>(Phaser: PhaserModule, o: StageOptions<S>): Stage {
  const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  let w = Math.round(o.width * dpr),
    h = Math.round(o.height * dpr);
  let game: PhaserNS.Game | null = null;
  let asleep = false;

  class RageScene extends Phaser.Scene {
    gfx!: PhaserNS.GameObjects.Graphics;
    bg!: PhaserNS.GameObjects.Graphics;
    /** R4-21: the scene colour and dot grid, drawn once into a one-dot tile and repeated by the GPU. */
    dots!: PhaserNS.GameObjects.TileSprite;
    dotsUsed = false;
    labels = new Map<string, PhaserNS.GameObjects.Text>();
    /** Per-frame scratch, made once and reused, so a frame allocates nothing for the garbage collector. */
    used = new Set<string>();
    ctx!: DrawCtx;
    constructor() {
      super("rage");
    }
    create() {
      // One tile of the backdrop (DOT_STEP css px square, the dot in its centre) on a 2D canvas, once.
      const tile = Math.max(2, Math.round(DOT_STEP * dpr));
      if (!this.textures.exists(DOTS_KEY)) {
        const tex = this.textures.createCanvas(DOTS_KEY, tile, tile);
        const c = tex?.getContext();
        if (tex && c) {
          c.fillStyle = hex(SCENE.bg);
          c.fillRect(0, 0, tile, tile);
          c.fillStyle = hex(SCENE.dot);
          c.beginPath();
          c.arc(tile / 2, tile / 2, 1.5 * dpr, 0, Math.PI * 2);
          c.fill();
          tex.refresh();
        }
      }
      this.dots = this.add.tileSprite(0, 0, w, h, DOTS_KEY).setOrigin(0, 0).setDepth(-3).setVisible(false);
      this.bg = this.add.graphics();
      this.bg.setDepth(-2);
      this.gfx = this.add.graphics();
      const used = this.used;
      const dots = this.dots;
      this.ctx = {
        g: this.gfx,
        bg: this.bg,
        w,
        h,
        dpr,
        now: 0,
        reduced: false,
        palette: o.palette,
        backdrop: (dx, dy) => {
          this.dotsUsed = true;
          // A dot sits at the tile's centre: shifting the grid by (dx, dy) moves the texture the other way.
          dots.setTilePosition(wrap(-dx, tile), wrap(-dy, tile));
        },
        label: (key, text, x, y, st: LabelStyle) => {
          used.add(key);
          let t = this.labels.get(key);
          if (!t) {
            t = this.add.text(0, 0, text, {
              fontFamily: "Geist, system-ui, sans-serif",
              fontSize: `${st.size * dpr}px`,
              fontStyle: String(st.weight ?? 600),
              color: st.color,
              backgroundColor: st.bg,
              padding: st.bg ? { x: 8 * dpr, y: 2 * dpr } : undefined,
            });
            t.setOrigin(0.5, 1);
            t.setDepth(st.behind ? -1 : 10);
            this.labels.set(key, t);
          }
          if (t.text !== text) t.setText(text);
          t.setPosition(Math.round(x), Math.round(y));
          t.setAlpha(st.alpha ?? 1);
          t.setVisible(true);
        },
      };
    }
    update(_time: number, delta: number) {
      const { sim, ghost } = o.frame(delta);
      const used = this.used;
      used.clear();
      const ctx = this.ctx;
      // the size can change between frames (resize), the rest is read fresh each frame
      ctx.w = w;
      ctx.h = h;
      ctx.now = performance.now();
      ctx.reduced = o.reduced();
      this.gfx.clear();
      this.bg.clear();
      this.dotsUsed = false;
      if (this.dots.width !== w || this.dots.height !== h) this.dots.setSize(w, h);
      o.painter.draw(ctx, sim, ghost);
      if (this.dots.visible !== this.dotsUsed) this.dots.setVisible(this.dotsUsed);
      for (const [k, t] of this.labels) if (!used.has(k)) t.setVisible(false);
      // Asked to sleep before the loop was running (Phaser starts it after boot): draw this one frame, then stop.
      if (asleep) this.game.loop.sleep();
    }
  }

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: o.parent,
    width: w,
    height: h,
    // Transparent until the painter's first frame, so the CSS poster under the canvas shows instead of a
    // cleared (black) buffer while Phaser boots; every painter fills the whole background each frame.
    transparent: true,
    banner: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scene: RageScene,
    scale: { mode: Phaser.Scale.NONE },
    render: { antialias: true, powerPreference: "low-power" },
  });

  const styleCanvas = () => {
    const c = game?.canvas;
    if (!c) return;
    c.style.width = `${Math.round(w / dpr)}px`;
    c.style.height = `${Math.round(h / dpr)}px`;
    c.style.display = "block";
  };
  game.events.once("ready", styleCanvas);
  styleCanvas();

  return {
    resize(width, height) {
      w = Math.round(width * dpr);
      h = Math.round(height * dpr);
      game?.scale.resize(w, h);
      styleCanvas();
    },
    setAwake(awake) {
      asleep = !awake;
      const loop = game?.loop;
      if (!loop) return;
      if (asleep && loop.running) loop.sleep();
      else if (!asleep && !loop.running && loop.started) loop.wake(true);
    },
    destroy() {
      game?.destroy(true);
      game = null;
    },
  };
}
