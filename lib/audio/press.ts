import type { PaletteEvent } from "./palette";

/**
 * Which palette sound a press on `target` should make (the app-wide pointerdown listener in Providers).
 * Cells and custom controls play their own sounds and opt out with role=gridcell or data-no-tick.
 *
 *   switch            toggle (rising when turning on, falling when turning off)
 *   menu checkbox     toggle too, read from aria-checked (game menu: Sound, Haptics; a radio only when it changes)
 *   menu item         tap (Radix menu items are not buttons)
 *   data-press=toggle toggle too, read from aria-pressed (board tool modes: Fill, Flag, Notes...)
 *   tab, main nav     nav (nothing when it is already the current one)
 *   data-press=soft   tap at a soft level (Undo, Erase, Clear: taking something back)
 *   button, toy link  tap
 */
export const SOFT_PRESS_GAIN = 0.55;

export function pressSound(target: Element | null): { event: PaletteEvent; step?: number; gain?: number } | null {
  const el = target?.closest?.(
    "button, a[href], [data-tick], [role=switch], [role=tab], [role=menuitem], [role=menuitemcheckbox], [role=menuitemradio]",
  );
  if (!el) return null;
  if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return null;
  const role = el.getAttribute("role");
  if (role === "switch" || role === "menuitemcheckbox")
    return { event: "toggle", step: el.getAttribute("aria-checked") === "true" ? 0 : 1 };
  if (role === "menuitemradio") return el.getAttribute("aria-checked") === "true" ? null : { event: "tap" };
  if (el.closest("[role=gridcell], [data-no-tick]")) return null;
  const press = el.getAttribute("data-press");
  if (press === "toggle") return { event: "toggle", step: el.getAttribute("aria-pressed") === "true" ? 0 : 1 };
  if (press === "soft") return { event: "tap", gain: SOFT_PRESS_GAIN };
  if (role === "tab") return el.getAttribute("aria-selected") === "true" ? null : { event: "nav" };
  if (el.tagName === "A") {
    if (el.closest("nav")) return el.getAttribute("aria-current") === "page" ? null : { event: "nav" };
    // Links styled as buttons tick like buttons; inline text links stay quiet.
    return /\b(press|toy)\b/.test(el.className) || el.hasAttribute("data-tick") ? { event: "tap" } : null;
  }
  return { event: "tap" };
}
