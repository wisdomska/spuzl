import type { FeedbackTone } from "@/games/types";
import { sudoku as t } from "@/lib/copy/sudoku";
import type { Analysis } from "./logic";

export interface StatusLine {
  text: string;
  tone: FeedbackTone;
  icon: string;
}

/**
 * The one status line the sudoku board shows for a position: a clear, else the first broken rule,
 * else how many cells are filled. The count is every filled cell, givens and the player's entries.
 */
export function statusLine(a: Pick<Analysis, "filled" | "bad" | "message" | "clear">, total: number): StatusLine {
  if (a.clear) return { text: t.cleared, tone: "success", icon: "check-circle" };
  if (a.bad.size) return { text: a.message, tone: "danger", icon: "warning" };
  return { text: t.placed(a.filled, total), tone: "info", icon: "grid-nine" };
}
