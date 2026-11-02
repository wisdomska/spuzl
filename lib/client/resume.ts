"use client";

import { useSyncExternalStore } from "react";
import { TIMED_RUNS } from "@/lib/game/leave";

/**
 * Resume for solo play (free play and levels), on this device. While a puzzle is being played the game keeps a
 * note of its attempt; leaving (any way) keeps the note, so the game card says Resume and opening the game again
 * asks the server for that attempt back (`POST /api/v1/attempts` with `resume`; the server checks it is the
 * player's, still open and recent, or starts a fresh one). A clear, a fail, a new puzzle or another level drops
 * the note. Dailies resume on the server already; timed scored runs never resume (leaving loses the run).
 */
export interface ResumeNote {
  attemptId: string;
  mode: "free" | "level";
  difficulty?: string;
  level?: number;
  /** ms since epoch, when the note was last written */
  at: number;
}

const KEY = "spuzl.resume";
/** Notes older than this are ignored (the server keeps a left attempt open for 36 hours). */
export const RESUME_NOTE_MS = 36 * 3_600_000;

type Notes = Record<string, ResumeNote>;
const listeners = new Set<() => void>();
let cache: { raw: string | null; notes: Notes } | null = null;

function read(): Notes {
  try {
    const raw = localStorage.getItem(KEY);
    if (cache && cache.raw === raw) return cache.notes;
    const notes = raw ? (JSON.parse(raw) as Notes) : {};
    cache = { raw, notes };
    return notes;
  } catch {
    return {};
  }
}

function write(notes: Notes) {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    /* storage blocked: resume simply isn't offered */
  }
  listeners.forEach((l) => l());
}

/** Can this game's solo play be resumed at all? */
export const resumable = (game: string) => !TIMED_RUNS.has(game);

/** The note for a game, when it is fresh enough. */
export function resumeNote(game: string, now = Date.now()): ResumeNote | null {
  const n = read()[game];
  return n && now - n.at < RESUME_NOTE_MS ? n : null;
}

/**
 * The attempt to ask the server for when a game starts in this mode: the note's, if it is for the same mode and
 * the start does not ask for something else (another difficulty in free play, another level).
 */
export function resumeIdFor(game: string, mode: string, opts: { difficulty?: string; level?: number } = {}): string | undefined {
  const n = resumeNote(game);
  if (!n || n.mode !== mode) return undefined;
  if (mode === "free" && opts.difficulty && n.difficulty && opts.difficulty !== n.difficulty) return undefined;
  if (mode === "level" && opts.level !== undefined && n.level !== opts.level) return undefined;
  return n.attemptId;
}

export function keepResume(game: string, note: Omit<ResumeNote, "at">, now = Date.now()) {
  if (!resumable(game)) return;
  const notes = read();
  const prev = notes[game];
  // Written on every move: only touch storage when something changed or the note is getting old.
  if (prev && prev.attemptId === note.attemptId && now - prev.at < 60_000) return;
  write({ ...notes, [game]: { ...note, at: now } });
}

export function dropResume(game: string, attemptId?: string) {
  const notes = read();
  if (!notes[game] || (attemptId && notes[game].attemptId !== attemptId)) return;
  const next = { ...notes };
  delete next[game];
  write(next);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};

/** Every game with a puzzle to resume, comma-joined (a stable snapshot); empty while server rendering. */
function resumeKeys(): string {
  const now = Date.now();
  return Object.keys(read())
    .filter((g) => resumeNote(g, now))
    .sort()
    .join(",");
}

/** The games with a solo puzzle to resume on this device (game cards say Resume). */
export function useResumeGames(): ReadonlySet<string> {
  const keys = useSyncExternalStore(subscribe, resumeKeys, () => "");
  return new Set(keys ? keys.split(",") : []);
}
