/**
 * Boots a Phaser game that only renders: one Scene, one Graphics layer redrawn every frame by a
 * Painter, and pooled Text labels. The Phaser module is passed in by the Board after a dynamic
 * `import("phaser")`, so Phaser lives in its own lazy chunk and never in other routes.
 */
import type * as PhaserNS from "phaser";
import type { DrawCtx, LabelStyle, Painter, Palette } from "./render/types";

type PhaserModule = typeof PhaserNS;

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
  destroy(): void;
}

export function startStage<S>(Phaser: PhaserModule, o: StageOptions<S>): Stage {
  const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  let w = Math.round(o.width * dpr),
    h = Math.round(o.height * dpr);
  let game: PhaserNS.Game | null = null;

  class RageScene extends Phaser.Scene {
    gfx!: PhaserNS.GameObjects.Graphics;
    bg!: PhaserNS.GameObjects.Graphics;
    labels = new Map<string, PhaserNS.GameObjects.Text>();
    constructor() {
      super("rage");
    }
    create() {
      this.bg = this.add.graphics();
      this.bg.setDepth(-2);
      this.gfx = this.add.graphics();
    }
    update(_time: number, delta: number) {
      const { sim, ghost } = o.frame(delta);
      const used = new Set<string>();
      const ctx: DrawCtx = {
        g: this.gfx,
        bg: this.bg,
        w,
        h,
        dpr,
        now: performance.now(),
        reduced: o.reduced(),
        palette: o.palette,
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
      this.gfx.clear();
      this.bg.clear();
      o.painter.draw(ctx, sim, ghost);
      for (const [k, t] of this.labels) if (!used.has(k)) t.setVisible(false);
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
    destroy() {
      game?.destroy(true);
      game = null;
    },
  };
}
