import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { pageParams, sortParams } from "@/lib/admin/paging";
import { parsePlayerFilters } from "@/lib/admin/player-filters";
import { listPlayers } from "@/lib/admin/players";
import { can } from "@/lib/admin/roles";
import { PLAYER_SORT } from "@/lib/admin/sorting";

/**
 * GET /api/admin/players?q=&account=&age=&status=&reports=&test=&joinedFrom=&joinedTo=&activeFrom=&activeTo=
 * &sort=&dir=&page=&pageSize=: one page of players (guests and signed in), filtered and sorted in Postgres.
 * `q` is a player id, an exact email (players.pii roles only) or part of a nickname. Emails are masked unless the
 * role holds players.pii. Test accounts are left out unless `test=include|only`.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("players.read");
  const sp = new URL(req.url).searchParams;
  const p = pageParams(sp);
  const sort = sortParams(sp, PLAYER_SORT);
  const f = parsePlayerFilters(sp);
  if (!f.success) throw new ApiError(400, "bad_filter", f.error);
  const { rows, total } = await listPlayers(ctx, f.data, sort, p);
  return ok({ rows, page: p.page, pageSize: p.pageSize, total, sort, emailVisible: can(ctx.role, "players.pii") });
});
