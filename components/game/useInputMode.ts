"use client";

import { useSyncExternalStore } from "react";

/*
 * Which input the player has, so word games can drop the on-screen letter keyboard on a computer.
 *
 * A device whose primary pointer is precise and can hover (a mouse or trackpad) almost always has a physical
 * keyboard: there the on-screen keys only take room from the board, and the game shows the typing keys
 * instead. Media queries, never the user agent (iPads with trackpads and touch laptops exist):
 *   - `(pointer: fine) and (hover: hover)`: keyboard likely, on-screen keys hidden.
 *   - A touch on the screen (a touch laptop, a tablet with a mouse) brings the keys back for the session.
 *   - The player's own choice ("Show keyboard" / "Hide keyboard") wins over both and is remembered.
 */

/** The media query for a precise, hovering primary pointer (mouse or trackpad). */
export const FINE_POINTER_QUERY = "(pointer: fine) and (hover: hover)";
/** localStorage key for the player's on-screen keyboard choice ("show" or "hide"). */
export const KEYS_PREF_KEY = "spuzl.onscreenKeys";

export type KeysPref = "show" | "hide" | null;

export interface InputSignals {
  /** primary pointer is fine and can hover */
  fine: boolean;
  /** a touch landed on the screen this session */
  touched: boolean;
  /** the player's own choice, if any */
  pref: KeysPref;
}

/** Does this device most likely have a physical keyboard? (A fine, hovering pointer and no touch seen.) */
export function hasPhysicalKeyboard(s: Pick<InputSignals, "fine" | "touched">): boolean {
  return s.fine && !s.touched;
}

/** Should the on-screen letter keyboard show? The player's choice first, then the device. */
export function showOnScreenKeys(s: InputSignals): boolean {
  if (s.pref === "show") return true;
  if (s.pref === "hide") return false;
  return !hasPhysicalKeyboard(s);
}

/* ---------- the store: media query, touch seen, the stored choice ---------- */

let touched = false;
let pref: KeysPref | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readPref(): KeysPref {
  if (pref !== undefined) return pref;
  try {
    const v = localStorage.getItem(KEYS_PREF_KEY);
    pref = v === "show" || v === "hide" ? v : null;
  } catch {
    pref = null;
  }
  return pref;
}

function finePointer(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(FINE_POINTER_QUERY).matches;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = typeof window.matchMedia === "function" ? window.matchMedia(FINE_POINTER_QUERY) : null;
  const onTouch = (e: PointerEvent) => {
    if (e.pointerType !== "touch" || touched) return;
    touched = true;
    emit();
  };
  mq?.addEventListener?.("change", cb);
  window.addEventListener("pointerdown", onTouch, { passive: true, capture: true });
  return () => {
    listeners.delete(cb);
    mq?.removeEventListener?.("change", cb);
    window.removeEventListener("pointerdown", onTouch, { capture: true });
  };
}

/** One string so useSyncExternalStore compares a primitive. */
const snapshot = () => `${finePointer() ? 1 : 0}${touched ? 1 : 0}${readPref() ?? "-"}`;
/** Server and hydration: a touch device with no choice, so the keys render and phones never flash empty. */
const serverSnapshot = () => "00-";

function decode(s: string): InputSignals {
  const p = s.slice(2);
  return { fine: s[0] === "1", touched: s[1] === "1", pref: p === "-" ? null : (p as KeysPref) };
}

/** True when the device most likely has a physical keyboard (fine, hovering pointer, no touch seen). */
export function usePhysicalKeyboard(): boolean {
  return hasPhysicalKeyboard(decode(useSyncExternalStore(subscribe, snapshot, serverSnapshot)));
}

/**
 * The on-screen keyboard's state for a word game: whether to show it, whether the device has a physical
 * keyboard (so the typing keys are worth showing and a Hide button makes sense) and the toggle.
 */
export function useOnScreenKeys(): { show: boolean; physical: boolean; toggle: () => void } {
  const s = decode(useSyncExternalStore(subscribe, snapshot, serverSnapshot));
  const show = showOnScreenKeys(s);
  return { show, physical: hasPhysicalKeyboard(s), toggle: () => setKeysPref(show ? "hide" : "show") };
}

/** Remember the player's on-screen keyboard choice and tell every board. */
export function setKeysPref(next: Exclude<KeysPref, null>) {
  pref = next;
  try {
    localStorage.setItem(KEYS_PREF_KEY, next);
  } catch {
    /* private mode: the choice lasts for the session */
  }
  emit();
}

/** Tests only: forget the session's touch and the cached choice. */
export function resetInputModeForTests() {
  touched = false;
  pref = undefined;
}
