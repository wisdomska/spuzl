/**
 * Background music: a small generative sequencer. Every track is made, not stored: a style (per category, plus
 * Home and Versus, both upbeat and bright) sets the tempo range, scale, chords, instruments and groove; a seed (the game id) picks the key,
 * tempo, progression and melody, so each game has its own tune in its category's sound. Notes are scheduled a
 * little ahead on the audio clock (the usual Web Audio lookahead pattern), so timing holds when the page is busy.
 *
 * Pure description lives here (styles, `trackFor`); `createPlayer` does the scheduling on a given context.
 */
import { createRng } from "@/lib/rng";
import { ring, type Mode } from "./physical";
import { N, noise, tone, type Kit } from "./voices";

export type StyleId = "home" | "logic" | "word" | "reflex" | "board" | "versus";
type Lead = "keys" | "bell" | "marimba" | "chip" | "kora" | "pluck";
type Drums = "none" | "lofi" | "shaker" | "chip" | "bell" | "drive";

interface Style {
  bpm: [number, number];
  /** semitones of the scale the melody uses */
  scale: number[];
  /** chord roots as scale steps, four per progression */
  progressions: number[][];
  /** the scale chords are built from (stacked thirds on each degree, so every chord stays in key) */
  harmony: number[];
  /** notes per chord: 3 (triads) or 4 (sevenths) */
  voices: 3 | 4;
  /** lowest key (MIDI) a seed may pick, and how many semitones up from there */
  root: [number, number];
  lead: Lead;
  drums: Drums;
  /** chance an eighth note in the melody sounds */
  density: number;
  /** delay of off-beat sixteenths, as a share of a sixteenth (swing) */
  swing: number;
  padGain: number;
}

const MAJ_PENTA = [0, 2, 4, 7, 9];
const MIN_PENTA = [0, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];

export const STYLES: Record<StyleId, Style> = {
  // Home, worlds, library, tabs: upbeat and bright, a cheerful electric-piano groove over shakers (major key, the
  // I-V-vi-IV and I-IV-V-IV progressions everyone hums along to). No mallets anywhere (owner's call).
  home: {
    bpm: [106, 114],
    scale: MAJ_PENTA,
    progressions: [
      [0, 4, 5, 3],
      [0, 3, 4, 3],
    ],
    harmony: MAJOR,
    voices: 3,
    root: [53, 5],
    lead: "keys",
    drums: "shaker",
    density: 0.58,
    swing: 0.08,
    padGain: 0.04,
  },
  // Puzzles: calm and spacious so thinking comes first, soft electric piano.
  logic: {
    bpm: [70, 84],
    scale: MAJ_PENTA,
    progressions: [
      [0, 4, 5, 3],
      [0, 3, 0, 4],
      [5, 3, 0, 4],
    ],
    harmony: MAJOR,
    voices: 4,
    root: [48, 8],
    lead: "keys",
    drums: "none",
    density: 0.3,
    swing: 0,
    padGain: 0.055,
  },
  // Words & Quiz: light and a little jazzy, on electric piano.
  word: {
    bpm: [90, 104],
    scale: DORIAN,
    progressions: [
      [0, 3, 4, 0],
      [0, 5, 1, 4],
    ],
    harmony: DORIAN,
    voices: 4,
    root: [50, 7],
    lead: "keys",
    drums: "shaker",
    density: 0.45,
    swing: 0.22,
    padGain: 0.045,
  },
  // Arcade: upbeat chiptune with a four-on-the-floor kick.
  reflex: {
    bpm: [118, 134],
    scale: MIN_PENTA,
    progressions: [
      [0, 5, 3, 4],
      [0, 3, 4, 3],
    ],
    harmony: AEOLIAN,
    voices: 3,
    root: [45, 7],
    lead: "chip",
    drums: "chip",
    density: 0.62,
    swing: 0,
    padGain: 0.03,
  },
  // Board Games: kora-like plucks over a West African bell pattern.
  board: {
    bpm: [88, 100],
    scale: MAJ_PENTA,
    progressions: [
      [0, 4, 0, 3],
      [0, 3, 4, 0],
    ],
    harmony: MAJOR,
    voices: 3,
    root: [47, 6],
    lead: "kora",
    drums: "bell",
    density: 0.55,
    swing: 0.1,
    padGain: 0.035,
  },
  // Duels and parties (and their lobbies): upbeat and bright too, livelier than Home: a plucked major-key lead
  // over a punchy kick.
  versus: {
    bpm: [124, 132],
    scale: MAJ_PENTA,
    progressions: [
      [0, 4, 5, 3],
      [5, 3, 0, 4],
    ],
    harmony: MAJOR,
    voices: 3,
    root: [50, 5],
    lead: "pluck",
    drums: "drive",
    density: 0.6,
    swing: 0,
    padGain: 0.03,
  },
};

export interface Track {
  id: string;
  style: StyleId;
  bpm: number;
  root: number;
  progression: number[];
  /** 16 sixteenth-note melody slots per bar for two bars: scale step, or null for a rest */
  motif: (number | null)[];
}

/** The track for a key ("home", "versus" or a game id) in a style: same key, same tune, every time. */
export function trackFor(id: string, style: StyleId): Track {
  const s = STYLES[style];
  const rng = createRng(`music:${id}`);
  const bpm = Math.round(s.bpm[0] + rng.next() * (s.bpm[1] - s.bpm[0]));
  const root = s.root[0] + Math.floor(rng.next() * s.root[1]);
  const progression = s.progressions[Math.floor(rng.next() * s.progressions.length)];
  // A two-bar motif on eighth notes: mostly stepwise, resting often enough to breathe.
  const motif: (number | null)[] = [];
  let step = Math.floor(rng.next() * s.scale.length);
  for (let i = 0; i < 32; i++) {
    if (i % 2 === 1) {
      motif.push(null);
      continue;
    }
    if (rng.next() > s.density) {
      motif.push(null);
      continue;
    }
    step = Math.max(0, Math.min(s.scale.length * 2 - 1, step + [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng.next() * 7)]));
    motif.push(step);
  }
  return { id, style, bpm, root, progression, motif };
}

/* ---------------- Instruments (all on the music bus) ---------------- */

const noteOf = (s: Style, root: number, step: number) => {
  const oct = Math.floor(step / s.scale.length);
  return root + 12 + s.scale[step % s.scale.length] + 12 * oct;
};

function lead(k: Kit, kind: Lead, f: number, t: number, len: number) {
  switch (kind) {
    case "keys":
      // Soft electric-piano-ish: sine with a bell partial, gentle decay.
      ring(k, t, [
        { f, d: 0.9, g: 0.05 },
        { f: f * 2, d: 0.35, g: 0.012 },
        { f: f * 3.01, d: 0.18, g: 0.006 },
      ]);
      return;
    case "bell":
      ring(k, t, [
        { f, d: 1.4, g: 0.04 },
        { f: f * 2.76, d: 0.5, g: 0.012 },
        { f: f * 5.4, d: 0.22, g: 0.005 },
      ]);
      return;
    case "marimba":
      ring(k, t, [
        { f, d: 0.45, g: 0.06 },
        { f: f * 3.98, d: 0.12, g: 0.014 },
      ]);
      return;
    case "kora": {
      // A plucked string: bright attack, harmonics dying faster than the fundamental.
      const modes: Mode[] = [1, 2, 3, 4].map((h, i) => ({ f: f * h * (1 + i * 0.002), d: 1.1 / (1 + i * 0.9), g: 0.05 / (1 + i * 1.3) }));
      ring(k, t, modes, { jitter: 0.002 });
      return;
    }
    case "pluck":
      ring(k, t, [
        { f, d: 0.35, g: 0.05 },
        { f: f * 2, d: 0.18, g: 0.018 },
      ]);
      return;
    case "chip":
      tone(k, f, t, Math.min(0.22, len * 0.9), { type: "square", gain: 0.035, lp: 2600 });
      return;
  }
}

/** Semitones of the chord on harmony degree `d` (thirds stacked inside the scale). */
export function chordTones(s: Pick<Style, "harmony" | "voices">, d: number): number[] {
  const h = s.harmony;
  return Array.from({ length: s.voices }, (_, i) => {
    const idx = d + i * 2;
    return h[idx % h.length] + 12 * Math.floor(idx / h.length);
  });
}

function pad(k: Kit, s: Style, root: number, degree: number, t: number, dur: number) {
  for (const iv of chordTones(s, degree)) {
    const f = N(root + iv);
    tone(k, f, t, dur, { type: "triangle", gain: s.padGain, attack: Math.min(0.8, dur * 0.3), lp: 1500 });
    tone(k, f * 1.004, t, dur, { gain: s.padGain * 0.6, attack: Math.min(0.9, dur * 0.35) });
  }
}

function bass(k: Kit, f: number, t: number, dur: number, chip: boolean) {
  if (chip) tone(k, f, t, dur, { type: "square", gain: 0.05, lp: 700 });
  else {
    tone(k, f, t, dur, { gain: 0.11, attack: 0.01 });
    tone(k, f * 2, t, dur * 0.6, { type: "triangle", gain: 0.02 });
  }
}

const kick = (k: Kit, t: number, g = 0.16) => tone(k, 110, t, 0.18, { gain: g, f2: 42, glide: 0.12, attack: 0.002 });
const hat = (k: Kit, t: number, g = 0.025) => noise(k, t, 0.03, { type: "highpass", freq: 7000, gain: g, attack: 0.001 });
const shaker = (k: Kit, t: number, g = 0.02) => noise(k, t, 0.06, { freq: 5200, q: 1.2, gain: g, attack: 0.012 });
const rim = (k: Kit, t: number, g = 0.03) => noise(k, t, 0.05, { freq: 1900, q: 2, gain: g, attack: 0.001 });
const gong = (k: Kit, t: number, low: boolean) =>
  ring(k, t, [
    { f: low ? 820 : 1180, d: 0.25, g: 0.03 },
    { f: low ? 2140 : 3010, d: 0.1, g: 0.01 },
  ]);
/** Standard West African bell pattern (12-step feel folded onto 16ths). */
const BELL = [0, 2, 4, 5, 7, 9, 11, 12, 14];

function drums(k: Kit, kind: Drums, step: number, t: number, breakdown: boolean) {
  if (kind === "none" || breakdown) return;
  const beat = step % 4 === 0;
  switch (kind) {
    case "lofi":
      if (step === 0 || step === 10) kick(k, t, 0.12);
      if (step === 4 || step === 12) rim(k, t, 0.025);
      if (step % 2 === 0) shaker(k, t, 0.012);
      return;
    case "shaker":
      if (step % 2 === 0) shaker(k, t, step % 4 === 0 ? 0.02 : 0.012);
      if (step === 0) kick(k, t, 0.08);
      return;
    case "chip":
      if (beat) kick(k, t, 0.15);
      if (step % 2 === 0) hat(k, t, step % 4 === 2 ? 0.03 : 0.015);
      if (step === 4 || step === 12) noise(k, t, 0.09, { freq: 2200, q: 0.8, gain: 0.05, attack: 0.001 });
      return;
    case "bell":
      if (BELL.includes(step)) gong(k, t, step === 0 || step === 7);
      if (step === 0 || step === 8) kick(k, t, 0.09);
      if (step % 2 === 1) shaker(k, t, 0.01);
      return;
    case "drive":
      if (beat) kick(k, t, 0.13);
      if (step % 2 === 1) hat(k, t, 0.02);
      if (step === 4 || step === 12) rim(k, t, 0.04);
      return;
  }
}

/* ---------------- The player ---------------- */

export interface MusicPlayer {
  stop(): void;
}

/**
 * Plays `track` on `out` until stopped: 4-bar progressions, the motif over them, a breakdown (no drums, sparser
 * melody) every fourth phrase so long sessions don't drone.
 */
/** Schedules a track's notes on `a` up to a given time; call again with a later time to continue. */
export function trackScheduler(a: BaseAudioContext, out: AudioNode, nbuf: AudioBuffer, track: Track) {
  const s = STYLES[track.style];
  const k: Kit = { a: a as AudioContext, out, noise: nbuf, rate: 1 };
  const sixteenth = 60 / track.bpm / 4;
  let next = a.currentTime + 0.1;
  let n = 0; // sixteenth count since start
  const rng = createRng(`music:${track.id}:play`);
  return (until: number) => {
    while (next < until) {
      const step = n % 16;
      const bar = Math.floor(n / 16);
      const phrase = Math.floor(bar / 4);
      const breakdown = phrase % 4 === 3;
      const swingDelay = step % 2 === 1 ? s.swing * sixteenth : 0;
      const t = next + swingDelay;
      const degree = track.progression[bar % 4];
      const chordRoot = track.root + chordTones(s, degree)[0];
      if (step === 0) {
        pad(k, s, track.root, degree, t, sixteenth * 16 * 1.05);
        bass(k, N(chordRoot - 12), t, sixteenth * 7, s.lead === "chip");
      }
      if (step === 8 && s.drums !== "none") bass(k, N(chordRoot - 12 + (s.lead === "chip" ? 12 : 7)), t, sixteenth * 6, s.lead === "chip");
      const m = track.motif[(bar % 2) * 16 + step];
      // In a breakdown the melody thins out; otherwise it occasionally varies by a step.
      if (m !== null && m !== undefined && (!breakdown || rng.next() < 0.4)) {
        const v = rng.next() < 0.12 ? m + (rng.next() < 0.5 ? -1 : 1) : m;
        lead(k, s.lead, N(noteOf(s, track.root, Math.max(0, v))), t, sixteenth * 2);
      }
      drums(k, s.drums, step, t, breakdown);
      next += sixteenth;
      n++;
    }
  };
}

export function createPlayer(a: AudioContext, out: AudioNode, nbuf: AudioBuffer, track: Track): MusicPlayer {
  const run = trackScheduler(a, out, nbuf, track);
  const schedule = () => run(a.currentTime + 0.25);
  schedule();
  const timer = setInterval(schedule, 25);
  return {
    stop() {
      clearInterval(timer);
    },
  };
}
