import type { PaletteEvent } from "./palette";

/**
 * Which palette sound a press on `target` should make (the app-wide pointerdown listener in Providers).
 * Cells and custom controls play their own sounds and opt out with role=gridcell or data-no-tick.
 *
 *   switch            toggle (rising when turning on, falling when turning off)
 *   tab, main nav     nav (nothing when it is already the current one)
 *   button, toy link  tap
 */
export function pressSound(target: Element | null): { event: PaletteEvent; step?: number } | null {
  const el = target?.closest?.("button, a[href], [data-tick], [role=switch], [role=tab]");
  if (!el) return null;
  if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return null;
  const role = el.getAttribute("role");
  if (role === "switch") return { event: "toggle", step: el.getAttribute("aria-checked") === "true" ? 0 : 1 };
  if (el.closest("[role=gridcell], [data-no-tick]")) return null;
  if (role === "tab") return el.getAttribute("aria-selected") === "true" ? null : { event: "nav" };
  if (el.tagName === "A") {
    if (el.closest("nav")) return el.getAttribute("aria-current") === "page" ? null : { event: "nav" };
    // Links styled as buttons tick like buttons; inline text links stay quiet.
    return /\b(press|toy)\b/.test(el.className) || el.hasAttribute("data-tick") ? { event: "tap" } : null;
  }
  return { event: "tap" };
}
