import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { todayIso } from "@/lib/admin/dates";
import { EXPORT_MAX, ExportBody, parsePlayerFilters, playersCsv, type PlayerRow } from "@/lib/admin/player-filters";
import { queryPlayers } from "@/lib/admin/players";
import { can } from "@/lib/admin/roles";
import { PLAYER_SORT, parseSortQuery } from "@/lib/admin/sorting";

/**
 * POST /api/admin/players/export {search, ids?}: the filtered player list (or only the selected ids) as CSV
 * ({filename, csv, count, truncated}), in the list's sort order, up to 5,000 rows. Owner only (players.export);
 * the email column is included only for roles holding players.pii. Every export is audited.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("players.export");
  const input = await body(req, ExportBody);
  const sp = new URLSearchParams(input.search.startsWith("?") ? input.search.slice(1) : input.search);
  const f = parsePlayerFilters(sp);
  if (!f.success) throw new ApiError(400, "bad_filter", f.error);
  const sort = parseSortQuery(sp, PLAYER_SORT);
  if (!sort.success) throw new ApiError(400, "bad_sort", sort.error);
  const withEmail = can(ctx.role, "players.pii");

  let rows: PlayerRow[];
  let total: number;
  if (input.ids) {
    // Selected rows: look each id up (test accounts too), in the list's order.
    const found = await Promise.all(
      input.ids.map((id) => queryPlayers(ctx, { q: id, q_kind: "id", test: "include" }, sort.data, 1, 0).then((r) => r.rows[0])),
    );
    rows = found.filter((r): r is PlayerRow => !!r);
    total = rows.length;
  } else {
    ({ rows, total } = await queryPlayers(ctx, f.data, sort.data, EXPORT_MAX, 0));
  }
  const truncated = total > rows.length;
  await audit(ctx, "players.export", null, {
    count: rows.length,
    total,
    truncated,
    filters: input.ids ? null : f.data,
    ids: input.ids?.length ?? null,
    sort: sort.data,
    with_email: withEmail,
  });
  return ok({ filename: `spuzl-players-${todayIso()}.csv`, csv: playersCsv(rows, withEmail), count: rows.length, truncated });
});
