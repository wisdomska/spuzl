"use client";

import { create } from "zustand";

/**
 * Player settings. Audio keys persist to localStorage['spuzl.audio'] (Handoff contract),
 * everything else to localStorage['spuzl.settings']. Signed-in players also sync to their account.
 */
export type Theme = "dark" | "light" | "system";
export type ColourBlind = "off" | "protan" | "deutan" | "tritan";

export interface AudioSettings {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  /** true once the player has touched the haptics toggle, so reduced motion stops overriding it */
  hapticsTouched: boolean;
}

export interface DisplaySettings {
  theme: Theme;
  cb: ColourBlind;
  reducedMotion: "system" | "on" | "off";
  textScale: 100 | 110 | 120 | 130;
  relaxed: boolean;
  lowData: boolean;
}

export type Settings = AudioSettings & DisplaySettings;

export const AUDIO_KEY = "spuzl.audio";
export const SETTINGS_KEY = "spuzl.settings";

export const defaultSettings: Settings = {
  sfx: true,
  music: false,
  haptics: true,
  hapticsTouched: false,
  theme: "dark",
  cb: "off",
  reducedMotion: "system",
  textScale: 100,
  relaxed: false,
  lowData: false,
};

const AUDIO_FIELDS = ["sfx", "music", "haptics", "hapticsTouched"] as const;

function read(key: string): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  return { ...defaultSettings, ...read(SETTINGS_KEY), ...read(AUDIO_KEY) } as Settings;
}

function persist(s: Settings) {
  try {
    const audio: Record<string, unknown> = {};
    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) {
      if ((AUDIO_FIELDS as readonly string[]).includes(k)) audio[k] = v;
      else rest[k] = v;
    }
    localStorage.setItem(AUDIO_KEY, JSON.stringify(audio));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
  } catch {
    /* private mode: settings live for the session only */
  }
}

/** Resolves whether motion should be reduced, combining the in-app toggle with the OS preference. */
export function prefersReducedMotion(s: Pick<Settings, "reducedMotion">): boolean {
  if (s.reducedMotion === "on") return true;
  if (s.reducedMotion === "off") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Haptics default off under reduced motion, unless the player turned them back on. */
export function hapticsEnabled(s: Settings): boolean {
  if (!s.haptics) return false;
  if (!s.hapticsTouched && prefersReducedMotion(s)) return false;
  return true;
}

/** Mirrors display settings onto <html> so CSS tokens switch without a re-render. */
export function applyToDocument(s: Settings) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  const theme = s.theme === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : s.theme;
  el.dataset.theme = theme;
  if (s.cb === "off") delete el.dataset.cb;
  else el.dataset.cb = s.cb;
  el.dataset.motion = prefersReducedMotion(s) ? "reduce" : "full";
  el.dataset.lowData = String(s.lowData);
  el.dataset.relaxed = String(s.relaxed);
  el.style.setProperty("--text-scale", String(s.textScale / 100));
}

interface SettingsStore extends Settings {
  hydrated: boolean;
  hydrate: () => void;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  replace: (s: Partial<Settings>) => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...defaultSettings,
  hydrated: false,
  hydrate: () => {
    const s = loadSettings();
    set({ ...s, hydrated: true });
    applyToDocument(s);
  },
  set: (key, value) => {
    const patch = { [key]: value } as Partial<Settings>;
    if (key === "haptics") patch.hapticsTouched = true;
    set(patch);
    const next = pick(get());
    persist(next);
    applyToDocument(next);
  },
  replace: (s) => {
    set(s);
    const next = pick(get());
    persist(next);
    applyToDocument(next);
  },
}));

function pick(s: SettingsStore): Settings {
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(defaultSettings)) out[k] = (s as unknown as Record<string, unknown>)[k];
  return out as unknown as Settings;
}

/**
 * Inline boot script: runs before first paint so theme, colour-blind mode and text size never flash.
 * Kept dependency-free; mirrors applyToDocument.
 */
export const settingsBootScript = `(function(){try{var a=JSON.parse(localStorage.getItem('${AUDIO_KEY}')||'{}'),s=JSON.parse(localStorage.getItem('${SETTINGS_KEY}')||'{}'),e=document.documentElement,t=s.theme||'dark';if(t==='system')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';e.dataset.theme=t;if(s.cb&&s.cb!=='off')e.dataset.cb=s.cb;var rm=s.reducedMotion||'system';e.dataset.motion=rm==='on'||(rm==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches)?'reduce':'full';e.dataset.lowData=String(!!s.lowData);e.dataset.relaxed=String(!!s.relaxed);e.style.setProperty('--text-scale',String((s.textScale||100)/100));}catch(x){}})();`;
