"use client";

import { play } from "@/lib/audio";

/**
 * "Sparks earned" (Handoff motion spec): sparks arc on a curve from the source into the wallet,
 * 600 ms ease-in-out with a 30 ms stagger, then the wallet pops 1.08 on a spring. Sound: coin_ticks.
 * Reduced motion: no flight, the wallet number just swaps. Transform and opacity only (WAAPI).
 */
export function flySparks(from: Element | null, amount: number): Promise<void> {
  const wallet = [...document.querySelectorAll<HTMLElement>("[data-wallet]")].find((el) => el.getClientRects().length > 0);
  if (!from || !wallet || amount <= 0) return Promise.resolve();
  const reduce = document.documentElement.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  play("coin_ticks");
  if (reduce) return Promise.resolve();

  const a = from.getBoundingClientRect();
  const b = wallet.getBoundingClientRect();
  const n = Math.max(4, Math.min(12, Math.round(amount / 10)));
  const ease = "cubic-bezier(0.77, 0, 0.175, 1)";
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:70";
  document.body.appendChild(layer);

  const runs: Promise<unknown>[] = [];
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    const x0 = a.left + a.width / 2 + (Math.random() - 0.5) * Math.min(80, a.width);
    const y0 = a.top + a.height / 2 + (Math.random() - 0.5) * 16;
    const x1 = b.left + b.width * 0.3;
    const y1 = b.top + b.height / 2;
    s.style.cssText = `position:absolute;left:0;top:0;width:12px;height:12px;margin:-6px 0 0 -6px;background:var(--gold);clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);opacity:0`;
    layer.appendChild(s);
    // Quadratic curve that bows upward: sample it into keyframes.
    const cx = (x0 + x1) / 2 + (Math.random() - 0.5) * 60;
    const cy = Math.min(y0, y1) - 80 - Math.random() * 60;
    const frames: Keyframe[] = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
      const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1;
      frames.push({ transform: `translate(${x}px, ${y}px) scale(${1 - t * 0.4})`, opacity: k === 0 ? 0 : k === 10 ? 0.4 : 1, offset: t });
    }
    runs.push(s.animate(frames, { duration: 600, delay: i * 30, easing: ease, fill: "forwards" }).finished);
  }
  return Promise.all(runs).then(() => {
    layer.remove();
    wallet.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], {
      duration: 320,
      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    });
  });
}
