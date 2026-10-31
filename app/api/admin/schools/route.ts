import { handle, ok } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";

/** GET /api/admin/schools: schools awaiting verification first, then verified ones, with player counts. */
export const GET = handle(async () => {
  const ctx = await requireAdmin("schools.read");
  const { data, error } = await ctx.db
    .from("schools")
    .select("id, name, city, country, code, verified_by, created_at")
    .order("verified_by", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  const ids = (data ?? []).map((s) => s.id);
  const { data: members } = ids.length ? await ctx.db.from("players").select("school_id").in("school_id", ids) : { data: [] };
  const count = (id: string) => (members ?? []).filter((m) => m.school_id === id).length;
  return ok({ rows: (data ?? []).map((s) => ({ ...s, players: count(s.id), verified: !!s.verified_by })) });
});
