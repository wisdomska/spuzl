/**
 * SPUZL sound kit. Every SFX is synthesised with WebAudio (0 KB of files): recipes in voices.ts,
 * the palette (event → voice, lengths, variation) in palette.ts.
 * play(name, opts) plays the sound and fires the paired haptic, respecting settings.
 *
 * Signal chain: voice → per-play gain (level variation) → optional panner → SFX bus → master
 *   → 30 Hz high-pass (rumble) → high-shelf −3 dB at 6 kHz (warmth) → glue compressor → brick-wall limiter.
 *
 * - Names resolve through palette events (tap, clear...), Handoff aliases (tick_soft...) or voice names.
 * - At most MAX_VOICES overlap; extra plays are dropped, never queued. The same voice retriggered within
 *   RETRIGGER_MS is dropped too.
 * - Audio unlocks on the first user gesture only (autoplay rules). While locked, play() is silent and
 *   never throws; a context the browser left suspended is skipped rather than allowed to burst later.
 * - Optional per-world music loops, off by default, ducked during celebrations, disabled in low-data mode.
 * - Every play dispatches a `spuzl:fx` event so E2E tests can assert sound + haptic pairing.
 */
import { haptic, HAPTICS } from "@/lib/haptics";
import { canStart, clampPan, LENGTH_MS, resolve, variation, type SfxName } from "./palette";
import { N, RECIPES, tone, type Kit } from "./voices";

export { ALIASES, PALETTE, VOICES, resolve, type PaletteEvent, type SfxName } from "./palette";

export interface PlayOptions {
  /** pitch step: correct-move streak for pop (cap +7), letter index for chime/letter, line length for synth,
   * 1/0 for toggle on/off, numbers left for countdown (0 = go) */
  step?: number;
  /** skip the paired haptic (caller fires its own) */
  silentHaptic?: boolean;
  /** schedule this many seconds ahead on the audio clock (sample-accurate; the haptic follows by timer) */
  delay?: number;
  /** length in seconds for voices that stretch to match motion (rush, swoosh) */
  duration?: number;
  /** stereo start position, −1 left to 1 right */
  pan?: number;
  /** stereo end position, ramped over the sound's duration */
  panTo?: number;
  /** level multiplier, 0 to 1 */
  gain?: number;
}

interface Runtime {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  lowData: boolean;
}

const runtime: Runtime = { sfx: true, music: false, haptics: true, lowData: false };

export function configure(next: Partial<Runtime>) {
  Object.assign(runtime, next);
  if (!runtime.music || runtime.lowData) stopMusic();
}

let ac: AudioContext | null = null;
let sfxBus: GainNode;
let musicBus: GainNode;
let nbuf: AudioBuffer;
let unlocked = false;
const gate = { active: 0, last: {} as Partial<Record<SfxName, number>> };

type Activation = { userActivation?: { hasBeenActive?: boolean; isActive?: boolean } };

function build(a: AudioContext) {
  const master = a.createGain();
  master.gain.value = 0.7;
  const hp = a.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 30;
  const shelf = a.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 6000;
  shelf.gain.value = -3;
  const glue = a.createDynamicsCompressor();
  glue.threshold.value = -20;
  glue.knee.value = 12;
  glue.ratio.value = 3;
  glue.attack.value = 0.004;
  glue.release.value = 0.15;
  const limiter = a.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  master.connect(hp);
  hp.connect(shelf);
  shelf.connect(glue);
  glue.connect(limiter);
  limiter.connect(a.destination);
  sfxBus = a.createGain();
  sfxBus.connect(master);
  musicBus = a.createGain();
  musicBus.gain.value = 0.18;
  musicBus.connect(master);
  nbuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
  const d = nbuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  // A tap on an earlier page (client-side navigation) leaves sticky activation: no need to wait for another.
  if (!unlocked && (navigator as Navigator & Activation).userActivation?.hasBeenActive) unlocked = true;
  if (!unlocked) return null;
  if (!ac) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    build(ac);
  }
  if (ac.state !== "running") void ac.resume().catch(() => {});
  return ac;
}

/** True when a sound scheduled now would be heard now (not queued behind a suspended context). */
function ready(a: AudioContext) {
  if (a.state === "running") return true;
  // Inside a gesture the resume above lands within a frame; outside one, a suspended context would
  // replay everything at once when it finally wakes, so stay silent instead.
  const act = (navigator as Navigator & Activation).userActivation;
  return a.state === "suspended" && (act?.isActive ?? false);
}

/** Plays a sound with its paired haptic. Never throws. */
export function play(name: string, o: PlayOptions = {}) {
  const key = resolve(name);
  if (!key) return;
  let played = false;
  const delay = Math.max(0, o.delay ?? 0);
  try {
    const a = runtime.sfx ? ctx() : null;
    const now = Date.now() + delay * 1000;
    if (a && ready(a) && canStart(gate, key, now)) {
      const t = a.currentTime + 0.005 + delay;
      const v = variation(key);
      const out = a.createGain();
      out.gain.value = v.gain * Math.max(0, Math.min(1, o.gain ?? 1));
      if ((o.pan !== undefined || o.panTo !== undefined) && typeof a.createStereoPanner === "function") {
        const p = a.createStereoPanner();
        p.pan.setValueAtTime(clampPan(o.pan), t);
        if (o.panTo !== undefined) p.pan.linearRampToValueAtTime(clampPan(o.panTo), t + (o.duration ?? LENGTH_MS[key] / 1000));
        out.connect(p);
        p.connect(sfxBus);
      } else out.connect(sfxBus);
      const kit: Kit = { a, out, noise: nbuf, rate: v.rate };
      RECIPES[key](kit, t, o);
      gate.active++;
      gate.last[key] = now;
      played = true;
      setTimeout(
        () => {
          gate.active = Math.max(0, gate.active - 1);
          try {
            out.disconnect();
          } catch {
            /* already gone */
          }
        },
        LENGTH_MS[key] + delay * 1000 + 60,
      );
    }
  } catch {
    /* audio is decoration; never break gameplay */
  }
  const pattern = HAPTICS[key];
  if (!o.silentHaptic && pattern) {
    if (delay > 0) setTimeout(() => haptic(pattern), delay * 1000);
    else haptic(pattern);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("spuzl:fx", { detail: { sound: key, played, haptic: pattern ?? null } }));
  }
}

/** Call from the first pointerdown/keydown. Browsers block audio until then. */
export function unlock() {
  unlocked = true;
  try {
    ctx();
  } catch {
    /* ignore */
  }
}

export function isUnlocked() {
  return unlocked;
}

/** Test hook: back to the cold, locked state. */
export function __resetForTests() {
  unlocked = false;
  ac = null;
  gate.active = 0;
  gate.last = {};
  Object.assign(runtime, { sfx: true, music: false, haptics: true, lowData: false });
}

/* ---------- Music: short per-world loops, off by default ---------- */

export type WorldId = "logic" | "line" | "shape" | "number" | "word" | "clue" | "reflex" | "rage" | "board";

/** Each world gets a 4-bar pentatonic motif; tempo and timbre carry the world's personality. */
const LOOPS: Record<WorldId, { bpm: number; type: OscillatorType; notes: number[] }> = {
  logic: { bpm: 92, type: "triangle", notes: [60, 67, 64, 71, 62, 69, 67, 64] },
  line: { bpm: 104, type: "sine", notes: [62, 69, 74, 69, 64, 71, 76, 71] },
  shape: { bpm: 98, type: "triangle", notes: [57, 64, 60, 67, 59, 66, 62, 69] },
  number: { bpm: 110, type: "square", notes: [60, 64, 67, 72, 67, 64, 62, 65] },
  word: { bpm: 88, type: "sine", notes: [65, 69, 72, 69, 67, 70, 74, 70] },
  clue: { bpm: 96, type: "triangle", notes: [57, 60, 64, 62, 59, 62, 66, 64] },
  reflex: { bpm: 124, type: "square", notes: [64, 71, 76, 71, 66, 73, 78, 73] },
  rage: { bpm: 140, type: "sawtooth", notes: [52, 55, 59, 55, 50, 53, 57, 53] },
  board: { bpm: 84, type: "sine", notes: [62, 66, 69, 74, 64, 67, 71, 67] },
};

let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicWorld: WorldId | null = null;

export function startMusic(world: WorldId) {
  if (!runtime.music || runtime.lowData) return;
  if (musicWorld === world && musicTimer) return;
  stopMusic();
  const a = ctx();
  if (!a) return;
  musicWorld = world;
  const loop = LOOPS[world];
  const beat = 60 / loop.bpm / 2;
  const kit: Kit = { a, out: musicBus, noise: nbuf, rate: 1 };
  let i = 0;
  const schedule = () => {
    if (!ac) return;
    const t = ac.currentTime + 0.05;
    for (let k = 0; k < 4; k++) {
      tone(kit, N(loop.notes[(i + k) % loop.notes.length]), t + k * beat, beat * 0.9, {
        type: loop.type,
        gain: 0.12,
        lp: loop.type === "sine" || loop.type === "triangle" ? undefined : 1800,
      });
    }
    i += 4;
  };
  schedule();
  musicTimer = setInterval(schedule, beat * 4 * 1000);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  musicWorld = null;
}

/** Ducks music under celebrations (Handoff sound map). */
export function duck(ms = 1200) {
  if (!ac || !musicBus) return;
  const t = ac.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setTargetAtTime(0.04, t, 0.05);
  musicBus.gain.setTargetAtTime(0.18, t + ms / 1000, 0.2);
}
