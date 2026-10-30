/**
 * "Word found" motion (Handoff): letters lift off the board and fly to the word list, 420 ms ease-in-out
 * with a 40 ms stagger per letter, scaling to 0.6 as they land. Transform and opacity only, on fixed
 * clones appended to <body>, so the board itself never moves. Reduced motion skips the flight (the
 * caller's chip simply fades in). Resolves when the last letter lands.
 */
export const FLY_MS = 420;
export const FLY_STAGGER_MS = 40;

export function reducedMotion(): boolean {
  if (typeof document === "undefined") return true;
  if (document.documentElement.dataset.motion === "reduce") return true;
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function flyLetters(from: (HTMLElement | null)[], to: HTMLElement | null, letters: string[], opts: { color?: string; background?: string } = {}): Promise<void> {
  if (!to || reducedMotion() || typeof document === "undefined") return Promise.resolve();
  const target = to.getBoundingClientRect();
  const anims: Promise<unknown>[] = [];
  from.forEach((el, k) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const clone = document.createElement("span");
    clone.textContent = letters[k] ?? "";
    clone.setAttribute("aria-hidden", "true");
    Object.assign(clone.style, {
      position: "fixed",
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "999px",
      background: opts.background ?? "var(--world)",
      color: opts.color ?? "#0E0F1A",
      font: `700 ${Math.round(r.height * 0.55)}px var(--font-mono)`,
      pointerEvents: "none",
      zIndex: "70",
      willChange: "transform, opacity",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(clone);
    // land spread across the chip, left to right
    const tx = target.left + ((k + 0.5) / letters.length) * target.width - (r.left + r.width / 2);
    const ty = target.top + target.height / 2 - (r.top + r.height / 2);
    const a = clone.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
        { transform: `translate(${tx * 0.15}px, ${ty * 0.15 - 14}px) scale(1.12)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${tx}px, ${ty}px) scale(0.6)`, opacity: 0.2 },
      ],
      { duration: FLY_MS, delay: k * FLY_STAGGER_MS, easing: "cubic-bezier(.77, 0, .175, 1)", fill: "both" },
    );
    anims.push(a.finished.catch(() => undefined).finally(() => clone.remove()));
  });
  return Promise.all(anims).then(() => undefined);
}
