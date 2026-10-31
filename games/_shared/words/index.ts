/**
 * Family-safe English validation list (server and logic side). Built by build.ts from SCOWL size 50
 * plus EXTRA_WORDS. Clients should use `loadWords()` from ./lazy instead, so the list stays out of
 * game chunks.
 */
import { PACKED } from "./en.data";
import { unpack } from "./pack";

let cache: Set<string> | null = null;

/** The whole list as a Set, built once. Lowercase a to z, 3 to 15 letters. */
export function wordSet(): Set<string> {
  cache ??= new Set(unpack(PACKED));
  return cache;
}

/** Case-insensitive membership test. */
export function isWord(word: string): boolean {
  return wordSet().has(word.toLowerCase());
}
