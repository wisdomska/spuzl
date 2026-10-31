/**
 * Continuous input for Rage Ridge boards: tracks every key and pointer that is currently held and reports
 * the merged buttons per source, so a press keeps applying on every fixed step until it is released.
 * Keyboard auto-repeat only re-sends the last key pressed, so held keys live here rather than in
 * per-render state. No React and no DOM: the Board wires events in, `apply` goes to the controller.
 */
import { BTN } from "./sim/input";

export const KEY_BITS: Readonly<Record<string, number>> = {
  ArrowLeft: BTN.LEFT,
  KeyA: BTN.LEFT,
  ArrowRight: BTN.RIGHT,
  KeyD: BTN.RIGHT,
  Space: BTN.JUMP,
  ArrowUp: BTN.JUMP,
  KeyW: BTN.JUMP,
  KeyZ: BTN.JUMP,
  ArrowDown: BTN.DOWN,
  KeyS: BTN.DOWN,
};

/** `down` is true when a new press (or key repeat) caused the update, false for releases. */
export type ApplyHeld = (src: string, buttons: number, down: boolean) => void;

export class HeldInput {
  private keys = new Set<string>();
  /** source -> pointer ids holding it, with the source's buttons */
  private pointers = new Map<string, { ids: Set<number>; bits: number }>();
  private apply: ApplyHeld;

  constructor(apply: ApplyHeld = () => {}) {
    this.apply = apply;
  }

  /** Swaps the output (a new render's callback) while keeping everything that is held. */
  setApply(apply: ApplyHeld) {
    this.apply = apply;
  }

  keyBits(): number {
    let b = 0;
    for (const k of this.keys) b |= KEY_BITS[k] ?? 0;
    return b;
  }

  /** Returns false for keys the game does not use. Repeats re-apply the held buttons. */
  keyDown(code: string): boolean {
    if (!(code in KEY_BITS)) return false;
    this.keys.add(code);
    this.apply("key", this.keyBits(), true);
    return true;
  }

  keyUp(code: string) {
    if (!this.keys.delete(code)) return;
    this.apply("key", this.keyBits(), false);
  }

  pointerDown(src: string, id: number, bits: number) {
    const p = this.pointers.get(src) ?? { ids: new Set<number>(), bits };
    p.ids.add(id);
    p.bits = bits;
    this.pointers.set(src, p);
    this.apply(src, bits, true);
  }

  /** pointerup, pointercancel and lost capture all land here; the source releases when its last pointer lifts. */
  pointerUp(src: string, id: number) {
    const p = this.pointers.get(src);
    if (!p || !p.ids.delete(id)) return;
    if (p.ids.size) return;
    this.pointers.delete(src);
    this.apply(src, 0, false);
  }

  /** Changes what a held pointer presses (drag to swing) without releasing it. */
  pointerSet(src: string, id: number, bits: number) {
    const p = this.pointers.get(src);
    if (!p || !p.ids.has(id) || p.bits === bits) return;
    p.bits = bits;
    this.apply(src, bits, false);
  }

  held(src: string): boolean {
    return src === "key" ? this.keys.size > 0 : this.pointers.has(src);
  }

  /** Window blur, tab hidden: nothing can still be held. */
  releaseAll() {
    if (this.keys.size) {
      this.keys.clear();
      this.apply("key", 0, false);
    }
    for (const src of this.pointers.keys()) this.apply(src, 0, false);
    this.pointers.clear();
  }
}
