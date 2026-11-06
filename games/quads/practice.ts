/**
 * The Quads practice round (guided first play): two plain groups of four, so the first try teaches the idea
 * (lift four that share something, then Submit) before a full 16-word board. Its answers are public anyway.
 */
import type { QuadsGroup } from "./content";

/** Content index of the practice board's reference. Outside CONTENT, so it never names a real puzzle. */
export const PRACTICE_INDEX = 9999;

export const PRACTICE_GROUPS: QuadsGroup[] = [
  { label: "Colours of Ghana's flag", words: ["RED", "GOLD", "GREEN", "BLACK"] },
  { label: "Fruits at the market", words: ["MANGO", "PAWPAW", "PINEAPPLE", "BANANA"] },
];

/** The practice words in the order the board shows them (fixed, so the round is the same for everyone). */
export const PRACTICE_ORDER = ["MANGO", "RED", "GREEN", "PAWPAW", "BLACK", "BANANA", "GOLD", "PINEAPPLE"];
