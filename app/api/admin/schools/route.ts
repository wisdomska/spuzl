import { handle, ok } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { fetchPage, pageParams } from "@/lib/admin/paging";

/**
 * GET /api/admin/schools?page=&pageSize=: schools awaiting verification first, then verified ones, newest
 * first within each (id breaks ties), with player counts.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("schools.read");
  const p = pageParams(req);
  const { rows, total } = await fetchPage(
    () =>
      ctx.db
        .from("schools")
        .select("id, name, city, country, code, verified_by, created_at", { count: "exact" })
        .order("verified_by", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
    p,
  );
  const ids = rows.map((s) => s.id);
  const { data: members } = ids.length ? await ctx.db.from("players").select("school_id").in("school_id", ids) : { data: [] };
  const count = (id: string) => (members ?? []).filter((m) => m.school_id === id).length;
  return ok({
    rows: rows.map((s) => ({ ...s, players: count(s.id), verified: !!s.verified_by })),
    page: p.page,
    pageSize: p.pageSize,
    total,
  });
});
