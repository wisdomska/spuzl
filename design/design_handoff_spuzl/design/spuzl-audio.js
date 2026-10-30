// SPUZL sound + haptics. All SFX are synthesised with WebAudio (0 KB of audio files).
// play(name, {step}) plays the sound and the paired Vibration API pattern, respecting settings.
const LS = 'spuzl.audio';
export const settings = Object.assign({ sfx: true, haptics: true }, (() => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; } })());
export function set(k, v) { settings[k] = v; try { localStorage.setItem(LS, JSON.stringify(settings)); } catch (e) {} }

let ac, master, nbuf;
function A() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = .55;
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
function tone(f, t, dur, { type = 'sine', gain = .3, attack = .004, f2 = null } = {}) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .03);
}
function noise(t, dur, { gain = .2, freq = 1200, f2 = null, type = 'bandpass', q = 1 } = {}) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = nbuf; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .03);
}
const S = {
  tick: (t) => tone(1900, t, .03, { type: 'square', gain: .05 }),
  pop: (t, o) => { const n = 72 + Math.min(7, o.step || 0) * 2; tone(N(n), t, .09, { type: 'triangle', gain: .22, f2: N(n + 7) }); },
  buzz: (t) => { tone(110, t, .18, { type: 'sawtooth', gain: .12 }); tone(117, t + .02, .18, { type: 'sawtooth', gain: .09 }); },
  chime: (t, o) => tone(N(84 + (o.step || 0) * 2), t, .25, { type: 'sine', gain: .18 }),
  twinkle: (t) => [91, 95, 98].forEach((n, i) => tone(N(n), t + i * .07, .22, { type: 'sine', gain: .08 })),
  jingle: (t) => [72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * .09, .4, { type: 'triangle', gain: .2 })),
  fanfare: (t) => { [60, 64, 67].forEach((n, i) => tone(N(n), t + i * .11, .2, { type: 'square', gain: .07 })); [72, 76, 79].forEach(n => tone(N(n), t + .36, .8, { type: 'sawtooth', gain: .055 })); },
  whoosh: (t) => noise(t, .35, { freq: 500, f2: 3200, gain: .16, q: .8 }),
  swoosh: (t) => noise(t, .25, { freq: 2800, f2: 500, gain: .14, q: .9 }),
  fizzle: (t) => { noise(t, .5, { freq: 3000, f2: 300, gain: .1 }); tone(N(67), t, .45, { type: 'sine', gain: .1, f2: N(55) }); },
  clink: (t) => { tone(N(96), t, .45, { type: 'sine', gain: .15 }); tone(N(103), t + .012, .3, { type: 'sine', gain: .07 }); },
  coins: (t) => { for (let i = 0; i < 7; i++) tone(N(88 + (i % 2) * 4), t + i * .055, .07, { type: 'square', gain: .045 }); },
  cheer: (t) => { noise(t, 1.1, { freq: 1300, gain: .1, q: .4 }); [67, 71, 74, 79].forEach((n, i) => tone(N(n), t + .05 + i * .06, .6, { type: 'triangle', gain: .07 })); },
  splat: (t) => { noise(t, .18, { freq: 420, f2: 120, gain: .3, type: 'lowpass' }); tone(90, t, .16, { type: 'sine', gain: .3, f2: 40 }); },
  drum: (t) => { tone(150, t, .28, { type: 'sine', gain: .5, f2: 45 }); noise(t, .07, { freq: 2200, gain: .1 }); },
  horn: (t) => [60, 67, 72, 76].forEach(n => tone(N(n), t, .7, { type: 'sawtooth', gain: .06 })),
  hop: (t) => tone(N(76), t, .09, { type: 'sine', gain: .15, f2: N(88) }),
  emote: (t) => tone(N(81), t, .12, { type: 'triangle', gain: .15, f2: N(88) }),
  sting: (t) => { tone(N(70), t, .2, { type: 'square', gain: .06 }); tone(N(66), t + .13, .4, { type: 'square', gain: .06 }); },
  bump: (t) => { tone(120, t, .12, { type: 'sine', gain: .4, f2: 60 }); noise(t + .1, .3, { freq: 800, f2: 4000, gain: .08 }); },
  clack: (t) => { noise(t, .045, { freq: 1900, gain: .35, q: 3 }); tone(230, t, .06, { type: 'sine', gain: .18, f2: 140 }); },
  capture: (t) => { noise(t, .06, { freq: 1500, gain: .38, q: 2 }); noise(t + .05, .06, { freq: 950, gain: .25, q: 2 }); tone(180, t, .08, { type: 'sine', gain: .2 }); },
  check: (t) => { tone(N(79), t, .1, { type: 'square', gain: .06 }); tone(N(79), t + .25, .1, { type: 'square', gain: .06 }); }
};
const H = { tick: [8], pop: [6], buzz: [20, 40, 20], chime: [10], jingle: [30, 10, 30], fanfare: [50], whoosh: [15], swoosh: [10], clink: [25], cheer: [40], splat: [15], drum: [20], horn: [30], bump: [25], sting: [20, 30, 20], clack: [10], capture: [18], emote: [8], check: [12, 60, 12] };
export const names = Object.keys(S);
export function play(name, o = {}) {
  try {
    if (settings.sfx && S[name]) { const a = A(); S[name](a.currentTime + .005, o); }
    if (settings.haptics && H[name] && navigator.vibrate) navigator.vibrate(H[name]);
  } catch (e) {}
}
export function unlock() { try { A(); } catch (e) {} }
