import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { isContentGame, SCHEDULABLE } from "@/lib/admin/content-schemas";
import { buildFromItem } from "@/lib/admin/content-files";
import { reviewEntries } from "@/lib/admin/content-review-server";

/**
 * GET /api/admin/content/files/preview?game=&index= (content.read): the board players would get from one content.ts
 * entry (round 3, item 12), as corrected if it was edited, for the Review view's read-only preview. Games whose
 * board is one entry (Hunch, Coil, Quads...) get the real board; Quickfire's board is the entry and the four after it.
 * Pool games (Two Truths, Pinned, Flagged, Pixl...) answer `board: null`; the page draws the entry itself. Read only.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.read");
  const sp = new URL(req.url).searchParams;
  const game = sp.get("game") ?? "";
  const index = Number(sp.get("index"));
  if (!isContentGame(game)) throw new ApiError(400, "bad_game");
  if (!Number.isInteger(index) || index < 0) throw new ApiError(400, "bad_index");
  const plan = SCHEDULABLE[game];
  if (!plan) return ok({ board: null });
  const { entries } = await reviewEntries(ctx.db, game);
  const e = entries[index];
  if (!e) throw new ApiError(404, "entry_not_found");
  const served = (k: number) => {
    const x = entries[(index + k) % entries.length];
    return x.edit ?? x.entry;
  };
  const payload = plan.items === 1 ? served(0) : { items: Array.from({ length: plan.items }, (_, k) => served(k)) };
  try {
    const g = await buildFromItem(game, payload, "medium");
    return ok({ board: { puzzle: g.puzzle, solution: g.solution } });
  } catch {
    throw new ApiError(422, "no_board", "This entry doesn't build a board.");
  }
});
