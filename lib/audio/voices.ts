/**
 * Synth recipes for every voice in the palette. Each recipe schedules oscillators and filtered noise on
 * a per-play output node (`k.out`), which carries the level variation and stereo position; `k.rate`
 * nudges pitch a few cents so repeats never sound machine-gunned.
 *
 * Mixing notes: transients are band-passed noise (a few ms) for definition; bodies are sine/triangle
 * for warmth; square and saw only ever go through a low-pass so nothing is harsh; anything below 150 Hz
 * gets a harmonic partner so it still reads on a phone speaker.
 */
import type { PlayOptions } from "./index";
import type { SfxName } from "./palette";

export interface Kit {
  a: AudioContext;
  out: AudioNode;
  noise: AudioBuffer;
  rate: number;
}

export const N = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  /** end frequency; reached at `glide` seconds (default: the whole duration) */
  f2?: number | null;
  glide?: number;
  /** low-pass cutoff in Hz, for square/saw warmth */
  lp?: number;
  /** stereo position for this partial only */
  pan?: number;
  /** destination override (music bus) */
  dest?: AudioNode;
}

function panned(a: AudioContext, node: AudioNode, pan: number | undefined, dest: AudioNode) {
  if (pan && typeof a.createStereoPanner === "function") {
    const p = a.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p);
    p.connect(dest);
  } else node.connect(dest);
}

export function tone(k: Kit, f: number, t: number, dur: number, o: ToneOpts = {}) {
  const { a } = k;
  const { type = "sine", gain = 0.3, attack = 0.004, f2 = null, glide, lp, pan, dest } = o;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f * k.rate, t);
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2 * k.rate, t + (glide ?? dur));
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  let tail: AudioNode = g;
  if (lp) {
    const filter = a.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lp;
    filter.Q.value = 0.5;
    g.connect(filter);
    tail = filter;
  }
  panned(a, tail, pan, dest ?? k.out);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

interface NoiseOpts {
  gain?: number;
  freq?: number;
  f2?: number | null;
  type?: BiquadFilterType;
  q?: number;
  /** seconds to reach peak; a long attack makes a swell (whooshes) */
  attack?: number;
  pan?: number;
}

export function noise(k: Kit, t: number, dur: number, o: NoiseOpts = {}) {
  const { a } = k;
  const { gain = 0.2, freq = 1200, f2 = null, type = "bandpass", q = 1, attack = 0.003, pan } = o;
  const s = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  s.buffer = k.noise;
  s.loop = true;
  // Random start point: two noise hits in a row never share the same grain.
  const offset = Math.random() * (k.noise.duration - 0.05);
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq * k.rate, t);
  if (f2) f.frequency.exponentialRampToValueAtTime(f2 * k.rate, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(attack, dur * 0.95));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  panned(a, g, pan, k.out);
  s.start(t, Math.max(0, offset));
  s.stop(t + dur + 0.03);
}

type Recipe = (k: Kit, t: number, o: PlayOptions) => void;

const step = (o: PlayOptions) => o.step || 0;

export const RECIPES: Record<SfxName, Recipe> = {
  /* ---------- Core UI ---------- */
  tick: (k, t) => {
    // Soft wooden tap: a band-passed grain plus a falling sine knock. Heard many times a day, so quiet.
    noise(k, t, 0.022, { freq: 3200, q: 1.4, gain: 0.08 });
    tone(k, 1150, t, 0.045, { gain: 0.06, f2: 880 });
  },
  nav: (k, t) => {
    tone(k, 720, t, 0.04, { gain: 0.05, f2: 520 });
    noise(k, t, 0.012, { freq: 2600, gain: 0.035 });
  },
  toggle: (k, t, o) => {
    const on = o.step !== 0;
    const [a, b] = on ? [900, 1350] : [1350, 900];
    noise(k, t, 0.012, { freq: 3000, q: 2, gain: 0.05 });
    tone(k, a, t, 0.035, { gain: 0.06, f2: b });
    noise(k, t + 0.04, 0.01, { freq: on ? 3800 : 2400, q: 2, gain: 0.035 });
  },
  pop: (k, t, o) => {
    const n = 72 + Math.min(7, step(o)) * 2;
    tone(k, N(n), t, 0.09, { type: "triangle", gain: 0.16, f2: N(n + 7), lp: 4200 });
    tone(k, N(n - 12), t, 0.06, { gain: 0.07 });
    noise(k, t, 0.01, { freq: 5000, type: "highpass", gain: 0.025 });
  },
  sheet_open: (k, t) => {
    noise(k, t, 0.17, { freq: 700, f2: 1900, q: 0.9, gain: 0.05, attack: 0.09 });
    tone(k, 260, t, 0.12, { gain: 0.025, f2: 380 });
  },
  sheet_close: (k, t) => {
    noise(k, t, 0.14, { freq: 1700, f2: 600, q: 0.9, gain: 0.045, attack: 0.04 });
    tone(k, 340, t, 0.1, { gain: 0.025, f2: 230 });
  },
  notify: (k, t) => {
    tone(k, N(81), t, 0.26, { gain: 0.09 });
    tone(k, N(81) * 2.01, t, 0.1, { gain: 0.02 });
    tone(k, N(88), t + 0.11, 0.32, { gain: 0.09 });
    tone(k, N(88) * 2.01, t + 0.11, 0.12, { gain: 0.02 });
  },

  /* ---------- Game feedback ---------- */
  buzz: (k, t) => {
    // "Uh-uh": two short low-passed saw pulses with a sine floor. Felt more than heard; never shrill.
    [0, 0.095].forEach((d) => {
      tone(k, 118, t + d, 0.085, { type: "sawtooth", gain: 0.09, lp: 700 });
      tone(k, 124, t + d + 0.006, 0.085, { type: "sawtooth", gain: 0.06, lp: 700 });
      tone(k, 236, t + d, 0.05, { type: "triangle", gain: 0.04 });
    });
  },
  chime: (k, t, o) => {
    const f = N(84 + step(o) * 2);
    tone(k, f, t, 0.38, { gain: 0.13 });
    tone(k, f * 2.01, t, 0.18, { gain: 0.035 });
    tone(k, f * 3.0, t, 0.08, { gain: 0.012 });
  },
  twinkle: (k, t) =>
    [91, 95, 98].forEach((n, i) => {
      tone(k, N(n), t + i * 0.065, 0.24, { gain: 0.065, pan: -0.4 + i * 0.4 });
      tone(k, N(n - 12), t + i * 0.065, 0.16, { gain: 0.025, pan: -0.4 + i * 0.4 });
    }),
  success: (k, t) => {
    tone(k, N(76), t, 0.13, { type: "triangle", gain: 0.11, lp: 5000 });
    tone(k, N(83), t + 0.075, 0.24, { type: "triangle", gain: 0.12, lp: 5000 });
    tone(k, N(95), t + 0.075, 0.14, { gain: 0.025 });
  },
  jingle: (k, t) => {
    [72, 76, 79, 84].forEach((n, i) => {
      const last = i === 3;
      tone(k, N(n), t + i * 0.085, last ? 0.6 : 0.3, { type: "triangle", gain: 0.14, lp: 5200 });
      tone(k, N(n + 12), t + i * 0.085, 0.16, { gain: 0.03 });
    });
    tone(k, N(48), t + 0.255, 0.5, { gain: 0.08, attack: 0.01 });
  },
  fanfare: (k, t) => {
    [60, 64, 67].forEach((n, i) => tone(k, N(n), t + i * 0.1, 0.19, { type: "sawtooth", gain: 0.07, lp: 2400 }));
    [60, 64, 67, 72].forEach((n) => tone(k, N(n), t + 0.32, 0.85, { type: "sawtooth", gain: 0.045, lp: 2600, attack: 0.02 }));
    tone(k, N(48), t + 0.32, 0.8, { gain: 0.1, attack: 0.02 });
    noise(k, t + 0.32, 0.5, { freq: 6500, type: "highpass", gain: 0.02, attack: 0.05 });
  },
  clink: (k, t) => {
    tone(k, N(96), t, 0.45, { gain: 0.12 });
    tone(k, N(103), t + 0.012, 0.3, { gain: 0.05 });
    tone(k, N(96) * 2.76, t, 0.1, { gain: 0.015 });
  },
  coins: (k, t) => {
    for (let i = 0; i < 7; i++) {
      tone(k, N(88 + (i % 2) * 4), t + i * 0.055, 0.07, { type: "triangle", gain: 0.06, pan: i % 2 ? 0.25 : -0.25 });
    }
  },
  streak: (k, t) => {
    noise(k, t, 0.3, { freq: 400, f2: 2400, q: 0.8, gain: 0.08, attack: 0.22 });
    tone(k, N(79), t + 0.2, 0.18, { type: "triangle", gain: 0.1, lp: 5000 });
    tone(k, N(84), t + 0.28, 0.32, { type: "triangle", gain: 0.11, lp: 5000 });
    tone(k, N(72), t + 0.28, 0.3, { gain: 0.05 });
  },
  cheer: (k, t) => {
    noise(k, t, 1.1, { freq: 1300, gain: 0.08, q: 0.4, attack: 0.3 });
    [67, 71, 74, 79].forEach((n, i) => tone(k, N(n), t + 0.05 + i * 0.06, 0.6, { type: "triangle", gain: 0.06, pan: -0.3 + i * 0.2 }));
  },
  whoosh: (k, t) => noise(k, t, 0.34, { freq: 500, f2: 3200, gain: 0.13, q: 0.8, attack: 0.2 }),
  swoosh: (k, t, o) => noise(k, t, o.duration ?? 0.24, { freq: 2800, f2: 500, gain: 0.12, q: 0.9, attack: 0.08 }),
  fizzle: (k, t) => {
    noise(k, t, 0.5, { freq: 3000, f2: 300, gain: 0.07 });
    tone(k, N(67), t, 0.45, { gain: 0.08, f2: N(55) });
  },
  count: (k, t, o) => {
    if (step(o) === 0) {
      tone(k, N(84), t, 0.18, { type: "triangle", gain: 0.13, lp: 5000 });
      tone(k, N(72), t, 0.16, { gain: 0.07 });
      noise(k, t, 0.012, { freq: 4000, q: 1.5, gain: 0.05 });
    } else {
      tone(k, N(72), t, 0.11, { type: "triangle", gain: 0.1, lp: 4000 });
      noise(k, t, 0.01, { freq: 3000, q: 1.5, gain: 0.04 });
    }
  },
  win: (k, t) => {
    [67, 72, 76].forEach((n, i) => tone(k, N(n), t + i * 0.09, 0.2, { type: "triangle", gain: 0.12, lp: 5000 }));
    [72, 76, 79, 84].forEach((n, i) => tone(k, N(n), t + 0.3, 0.55, { type: "triangle", gain: 0.06, pan: -0.3 + i * 0.2 }));
    tone(k, N(48), t + 0.3, 0.55, { gain: 0.09 });
    noise(k, t + 0.3, 0.45, { freq: 6500, type: "highpass", gain: 0.02, attack: 0.04 });
  },
  lose: (k, t) => {
    tone(k, N(67), t, 0.22, { type: "triangle", gain: 0.09, lp: 2500 });
    tone(k, N(62), t + 0.16, 0.42, { type: "triangle", gain: 0.09, lp: 2500, f2: N(60) });
    tone(k, N(50), t + 0.16, 0.4, { gain: 0.05 });
  },
  join: (k, t) => {
    tone(k, 420, t, 0.08, { gain: 0.1, f2: 760 });
    tone(k, 620, t + 0.07, 0.1, { gain: 0.09, f2: 1100 });
  },

  /* ---------- Multiplayer and Rage ---------- */
  splat: (k, t) => {
    noise(k, t, 0.18, { freq: 420, f2: 120, gain: 0.26, type: "lowpass" });
    tone(k, 90, t, 0.16, { gain: 0.26, f2: 40 });
    tone(k, 180, t, 0.06, { type: "triangle", gain: 0.06, f2: 90 });
  },
  drum: (k, t) => {
    tone(k, 150, t, 0.28, { gain: 0.42, f2: 45, glide: 0.12 });
    tone(k, 300, t, 0.05, { type: "triangle", gain: 0.06, f2: 120 });
    noise(k, t, 0.06, { freq: 2200, gain: 0.08 });
  },
  horn: (k, t) => [60, 67, 72, 76].forEach((n) => tone(k, N(n), t, 0.7, { type: "sawtooth", gain: 0.055, lp: 2200, attack: 0.02 })),
  hop: (k, t) => tone(k, N(76), t, 0.09, { gain: 0.13, f2: N(88) }),
  emote: (k, t) => tone(k, N(81), t, 0.12, { type: "triangle", gain: 0.13, f2: N(88) }),
  sting: (k, t) => {
    tone(k, N(70), t, 0.2, { type: "square", gain: 0.05, lp: 2000 });
    tone(k, N(66), t + 0.13, 0.4, { type: "square", gain: 0.05, lp: 2000 });
  },
  bump: (k, t) => {
    tone(k, 120, t, 0.12, { gain: 0.34, f2: 60 });
    tone(k, 240, t, 0.05, { type: "triangle", gain: 0.06, f2: 120 });
    noise(k, t + 0.1, 0.3, { freq: 800, f2: 4000, gain: 0.07, attack: 0.15 });
  },
  clack: (k, t) => {
    noise(k, t, 0.045, { freq: 1900, gain: 0.3, q: 3 });
    tone(k, 230, t, 0.06, { gain: 0.16, f2: 140 });
  },
  capture: (k, t) => {
    noise(k, t, 0.06, { freq: 1500, gain: 0.32, q: 2 });
    noise(k, t + 0.05, 0.06, { freq: 950, gain: 0.22, q: 2 });
    tone(k, 180, t, 0.08, { gain: 0.18 });
  },
  check: (k, t) => {
    tone(k, N(79), t, 0.1, { type: "square", gain: 0.05, lp: 3000 });
    tone(k, N(79), t + 0.25, 0.1, { type: "square", gain: 0.05, lp: 3000 });
  },
  synth: (k, t, o) => {
    const n = 64 + Math.min(24, step(o));
    tone(k, N(n), t, 0.08, { type: "triangle", gain: 0.09, f2: N(n + 2) });
  },
  jump: (k, t) => tone(k, N(69), t, 0.12, { type: "square", gain: 0.05, f2: N(81), lp: 3000 }),
  land: (k, t) => {
    tone(k, 140, t, 0.07, { gain: 0.18, f2: 80 });
    tone(k, 280, t, 0.03, { type: "triangle", gain: 0.04 });
  },
  spike: (k, t) => {
    noise(k, t, 0.12, { freq: 3500, f2: 900, gain: 0.16, q: 2 });
    tone(k, N(58), t, 0.14, { type: "sawtooth", gain: 0.05, lp: 2500 });
  },

  /* ---------- Logo intro ---------- */
  rush: (k, t, o) => {
    // The Z's flight: band-passed air whose pitch and level climb with its speed, peaking at impact.
    // The voice bus pans it right to centre (pass pan / panTo). It cuts hard so the thump owns the hit.
    const d = o.duration ?? 0.42;
    noise(k, t, d + 0.04, { freq: 450, f2: 2600, q: 1.1, gain: 0.15, attack: d * 0.9 });
    noise(k, t, d + 0.03, { freq: 3000, f2: 7000, type: "highpass", gain: 0.035, attack: d * 0.9 });
    tone(k, 90, t, d, { gain: 0.04, f2: 170, attack: d * 0.8 });
  },
  thump: (k, t) => {
    // Body: a sine kick dropping 118 → 40 Hz; knock: a triangle at 190 Hz so phones hear it;
    // air: low-passed noise; click: a 14 ms high grain at the moment of contact.
    tone(k, 118, t, 0.34, { gain: 0.7, f2: 40, glide: 0.14, attack: 0.002 });
    tone(k, 190, t, 0.11, { type: "triangle", gain: 0.24, f2: 85, glide: 0.08, attack: 0.002 });
    noise(k, t, 0.09, { freq: 1100, f2: 180, type: "lowpass", gain: 0.2 });
    noise(k, t, 0.014, { freq: 4200, q: 1.2, gain: 0.15 });
    tone(k, 2100, t, 0.014, { gain: 0.04, attack: 0.001 });
  },
  letter: (k, t, o) => {
    // Soft felt tap; each letter a whole step higher so S P U L read as a little phrase.
    const f = 260 * Math.pow(2, (step(o) * 2) / 12);
    tone(k, f, t, 0.07, { gain: 0.15, f2: f * 0.6, glide: 0.05, attack: 0.002 });
    tone(k, f * 2, t, 0.03, { type: "triangle", gain: 0.035 });
    noise(k, t, 0.02, { freq: 1400, type: "lowpass", gain: 0.05 });
  },
  spuzpop: (k, t) => {
    tone(k, 360, t, 0.09, { gain: 0.17, f2: 980, glide: 0.06 });
    noise(k, t, 0.012, { freq: 2600, q: 1.5, gain: 0.05 });
    tone(k, N(84), t + 0.05, 0.1, { gain: 0.035 });
  },
};
