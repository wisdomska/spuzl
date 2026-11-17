/**
 * Board sizes of a game that has more than one (Spuzdoku: Sixer 6 × 6 and Nine 9 × 9). Shared by the play screen's
 * size picker and every list that names both ids (Party and Duel pickers, the admin Daily calendar), so it stays
 * free of client code.
 */
import { sizeCopy } from "@/lib/copy/size";

export const SIZES: Record<string, { id: string; n: number }[]> = {
  sixer: [
    { id: "sixer", n: 6 },
    { id: "nine", n: 9 },
  ],
  nine: [
    { id: "sixer", n: 6 },
    { id: "nine", n: 9 },
  ],
};

/** The board size (n of n × n) of a sized game id, or null for a game with one size. */
export const boardSize = (id: string): number | null => SIZES[id]?.find((s) => s.id === id)?.n ?? null;

/**
 * A game's name in a list that holds each board size as its own entry: "Spuzdoku 6 × 6", "Spuzdoku 9 × 9"; any
 * other game keeps its name.
 */
export function sizedName(g: { id: string; name: string }): string {
  const n = boardSize(g.id);
  return n ? `${g.name} ${sizeCopy.size(n)}` : g.name;
}
