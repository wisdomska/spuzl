import { z } from "zod";
import { handle, ok } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { playerDetail } from "@/lib/admin/players";

const Id = z.string().uuid();

/**
 * GET /api/admin/players/:id/detail: the player detail page (profile, account type and linked identities, stats,
 * recent attempts, reports made and received, moderation history, league, inventory, Sparks ledger and the audit
 * trail). Email masked unless the role holds players.pii; no location or school.
 */
export const GET = handle(async (_req: Request, rc: RouteContext<"/api/admin/players/[id]/detail">) => {
  const ctx = await requireAdmin("players.read");
  const id = Id.parse((await rc.params).id);
  return ok(await playerDetail(ctx, id));
});
