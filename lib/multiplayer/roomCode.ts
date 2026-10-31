/**
 * Party room codes (Handoff rule): 4 characters from a set without 0, O, 1 or I, case-insensitive
 * input, expiring 2 h after the room empties.
 */
import { TIMING } from "./constants";

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 4;

/** Random code from a uniform source (crypto on the server, a seeded rng in tests). */
export function makeRoomCode(random: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
  return s;
}

/** Normalises typed input: trims, uppercases and drops spaces and dashes. Returns null when it can never be a code. */
export function normalizeRoomCode(input: string): string | null {
  const s = input.trim().toUpperCase().replace(/[\s-]/g, "");
  return isRoomCode(s) ? s : null;
}

export function isRoomCode(s: string): boolean {
  if (s.length !== CODE_LENGTH) return false;
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return false;
  return true;
}

/** A room is joinable while someone is in it, and for 2 h after it empties. */
export function roomExpired(emptiedAt: string | null | undefined, now = Date.now()): boolean {
  return !!emptiedAt && now - Date.parse(emptiedAt) > TIMING.roomTtlMs;
}
