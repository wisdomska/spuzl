/**
 * SPUZL sound kit. Port of design/spuzl-audio.js: every SFX is synthesised with WebAudio (0 KB of files).
 * play(name, { step }) plays the sound and fires the paired haptic, respecting settings.
 *
 * Additions over the prototype (Handoff sound map):
 * - Handoff names (tick_soft, buzz_low, win_jingle...) alias the kit names.
 * - At most 4 voices overlap; extra plays are dropped, never queued.
 * - Audio unlocks on the first user gesture only (autoplay rules).
 * - Optional per-world music loops, off by default, ducked during celebrations, disabled in low-data mode.
 * - Every play dispatches a `spuzl:fx` event so E2E tests can assert sound + haptic pairing.
 */
import { haptic, HAPTICS } from "@/lib/haptics";

export type SfxName =
  | "tick"
  | "pop"
  | "buzz"
  | "chime"
  | "twinkle"
  | "jingle"
  | "fanfare"
  | "whoosh"
  | "swoosh"
  | "fizzle"
  | "clink"
  | "coins"
  | "cheer"
  | "splat"
  | "drum"
  | "horn"
  | "hop"
  | "emote"
  | "sting"
  | "bump"
  | "clack"
  | "capture"
  | "check"
  | "synth"
  | "jump"
  | "land"
  | "spike";

/** Handoff spec names mapped onto kit names. */
export const ALIASES: Record<string, SfxName> = {
  tick_soft: "tick",
  buzz_low: "buzz",
  win_jingle: "jingle",
  coin_ticks: "coins",
  crowd_cheer: "cheer",
  pass_swoosh: "swoosh",
  sting_short: "sting",
  emote_pop: "emote",
  synth_rise: "synth",
  fail_soft: "fizzle",
};

export interface PlayOptions {
  /** pitch step: correct-move streak for pop (cap +7), letter index for chime, line length for synth */
  step?: number;
  /** skip the paired haptic (caller fires its own) */
  silentHaptic?: boolean;
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
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let nbuf: AudioBuffer;
let unlocked = false;
let voices = 0;
const MAX_VOICES = 4;

function ctx(): AudioContext | null {
  if (typeof window === "undefined" || !unlocked) return null;
  if (!ac) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.55;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ac.destination);
    sfxBus = ac.createGain();
    sfxBus.connect(master);
    musicBus = ac.createGain();
    musicBus.gain.value = 0.18;
    musicBus.connect(master);
    nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = nbuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === "suspended") void ac.resume();
  return ac;
}

const N = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  f2?: number | null;
  bus?: GainNode;
}
function tone(f: number, t: number, dur: number, { type = "sine", gain = 0.3, attack = 0.004, f2 = null, bus }: ToneOpts = {}) {
  const a = ac!;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(bus ?? sfxBus);
  o.start(t);
  o.stop(t + dur + 0.03);
}

interface NoiseOpts {
  gain?: number;
  freq?: number;
  f2?: number | null;
  type?: BiquadFilterType;
  q?: number;
}
function noise(t: number, dur: number, { gain = 0.2, freq = 1200, f2 = null, type = "bandpass", q = 1 }: NoiseOpts = {}) {
  const a = ac!;
  const s = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  s.buffer = nbuf;
  s.loop = true;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  s.start(t);
  s.stop(t + dur + 0.03);
}

type Synth = (t: number, o: PlayOptions) => void;

/** Synth recipes, ported verbatim from spuzl-audio.js, plus the Rage Ridge and line sounds from the Handoff map. */
const S: Record<SfxName, Synth> = {
  tick: (t) => tone(1900, t, 0.03, { type: "square", gain: 0.05 }),
  pop: (t, o) => {
    const n = 72 + Math.min(7, o.step || 0) * 2;
    tone(N(n), t, 0.09, { type: "triangle", gain: 0.22, f2: N(n + 7) });
  },
  buzz: (t) => {
    tone(110, t, 0.18, { type: "sawtooth", gain: 0.12 });
    tone(117, t + 0.02, 0.18, { type: "sawtooth", gain: 0.09 });
  },
  chime: (t, o) => tone(N(84 + (o.step || 0) * 2), t, 0.25, { type: "sine", gain: 0.18 }),
  twinkle: (t) => [91, 95, 98].forEach((n, i) => tone(N(n), t + i * 0.07, 0.22, { type: "sine", gain: 0.08 })),
  jingle: (t) => [72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.09, 0.4, { type: "triangle", gain: 0.2 })),
  fanfare: (t) => {
    [60, 64, 67].forEach((n, i) => tone(N(n), t + i * 0.11, 0.2, { type: "square", gain: 0.07 }));
    [72, 76, 79].forEach((n) => tone(N(n), t + 0.36, 0.8, { type: "sawtooth", gain: 0.055 }));
  },
  whoosh: (t) => noise(t, 0.35, { freq: 500, f2: 3200, gain: 0.16, q: 0.8 }),
  swoosh: (t) => noise(t, 0.25, { freq: 2800, f2: 500, gain: 0.14, q: 0.9 }),
  fizzle: (t) => {
    noise(t, 0.5, { freq: 3000, f2: 300, gain: 0.1 });
    tone(N(67), t, 0.45, { type: "sine", gain: 0.1, f2: N(55) });
  },
  clink: (t) => {
    tone(N(96), t, 0.45, { type: "sine", gain: 0.15 });
    tone(N(103), t + 0.012, 0.3, { type: "sine", gain: 0.07 });
  },
  coins: (t) => {
    for (let i = 0; i < 7; i++) tone(N(88 + (i % 2) * 4), t + i * 0.055, 0.07, { type: "square", gain: 0.045 });
  },
  cheer: (t) => {
    noise(t, 1.1, { freq: 1300, gain: 0.1, q: 0.4 });
    [67, 71, 74, 79].forEach((n, i) => tone(N(n), t + 0.05 + i * 0.06, 0.6, { type: "triangle", gain: 0.07 }));
  },
  splat: (t) => {
    noise(t, 0.18, { freq: 420, f2: 120, gain: 0.3, type: "lowpass" });
    tone(90, t, 0.16, { type: "sine", gain: 0.3, f2: 40 });
  },
  drum: (t) => {
    tone(150, t, 0.28, { type: "sine", gain: 0.5, f2: 45 });
    noise(t, 0.07, { freq: 2200, gain: 0.1 });
  },
  horn: (t) => [60, 67, 72, 76].forEach((n) => tone(N(n), t, 0.7, { type: "sawtooth", gain: 0.06 })),
  hop: (t) => tone(N(76), t, 0.09, { type: "sine", gain: 0.15, f2: N(88) }),
  emote: (t) => tone(N(81), t, 0.12, { type: "triangle", gain: 0.15, f2: N(88) }),
  sting: (t) => {
    tone(N(70), t, 0.2, { type: "square", gain: 0.06 });
    tone(N(66), t + 0.13, 0.4, { type: "square", gain: 0.06 });
  },
  bump: (t) => {
    tone(120, t, 0.12, { type: "sine", gain: 0.4, f2: 60 });
    noise(t + 0.1, 0.3, { freq: 800, f2: 4000, gain: 0.08 });
  },
  clack: (t) => {
    noise(t, 0.045, { freq: 1900, gain: 0.35, q: 3 });
    tone(230, t, 0.06, { type: "sine", gain: 0.18, f2: 140 });
  },
  capture: (t) => {
    noise(t, 0.06, { freq: 1500, gain: 0.38, q: 2 });
    noise(t + 0.05, 0.06, { freq: 950, gain: 0.25, q: 2 });
    tone(180, t, 0.08, { type: "sine", gain: 0.2 });
  },
  check: (t) => {
    tone(N(79), t, 0.1, { type: "square", gain: 0.06 });
    tone(N(79), t + 0.25, 0.1, { type: "square", gain: 0.06 });
  },
  // Handoff additions
  synth: (t, o) => {
    const n = 64 + Math.min(24, o.step || 0);
    tone(N(n), t, 0.08, { type: "triangle", gain: 0.1, f2: N(n + 2) });
  },
  jump: (t) => tone(N(69), t, 0.12, { type: "square", gain: 0.06, f2: N(81) }),
  land: (t) => tone(140, t, 0.07, { type: "sine", gain: 0.2, f2: 80 }),
  spike: (t) => {
    noise(t, 0.12, { freq: 3500, f2: 900, gain: 0.18, q: 2 });
    tone(N(58), t, 0.14, { type: "sawtooth", gain: 0.06 });
  },
};

/** Approximate audible length per sound, used to free voice slots. */
const LENGTH_MS: Partial<Record<SfxName, number>> = {
  jingle: 700,
  fanfare: 1200,
  cheer: 1150,
  fizzle: 500,
  horn: 700,
  clink: 450,
  coins: 400,
  check: 350,
  sting: 550,
  bump: 400,
  whoosh: 350,
};

export const names = Object.keys(S) as SfxName[];

export function resolve(name: string): SfxName | null {
  if (name in S) return name as SfxName;
  return ALIASES[name] ?? null;
}

/** Plays a sound with its paired haptic. Never throws. */
export function play(name: string, o: PlayOptions = {}) {
  const key = resolve(name);
  if (!key) return;
  let played = false;
  try {
    if (runtime.sfx && voices < MAX_VOICES) {
      const a = ctx();
      if (a) {
        S[key](a.currentTime + 0.005, o);
        voices++;
        played = true;
        setTimeout(() => (voices = Math.max(0, voices - 1)), LENGTH_MS[key] ?? 250);
      }
    }
  } catch {
    /* audio is decoration; never break gameplay */
  }
  const pattern = HAPTICS[key];
  if (!o.silentHaptic && pattern) haptic(pattern);
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
  let i = 0;
  const schedule = () => {
    if (!ac) return;
    const t = ac.currentTime + 0.05;
    for (let k = 0; k < 4; k++) {
      tone(N(loop.notes[(i + k) % loop.notes.length]), t + k * beat, beat * 0.9, { type: loop.type, gain: 0.12, bus: musicBus });
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
