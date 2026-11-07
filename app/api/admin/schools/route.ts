import { randomInt } from "node:crypto";
import { body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { fetchPage, pageParams } from "@/lib/admin/paging";
import { makeCode } from "@/lib/social";
import { SchoolInput } from "@/lib/schools";

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
        .select("id, name, city, country, code, kind, verified_by, created_at", { count: "exact" })
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

/**
 * POST /api/admin/schools { name, city?, country?, kind }: an admin seeds a school or campus (R2-P5). It is verified
 * at once (the admin vouches for it), gets a school code teachers use for School Cup, and can be joined and ranked
 * once "features.schoolLeagues" is on. Audited as school.create.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("schools.write");
  const input = await body(req, SchoolInput);
  for (let i = 0; i < 8; i++) {
    const { data, error } = await ctx.db
      .from("schools")
      .insert({
        name: input.name,
        city: input.city ?? null,
        country: input.country ?? null,
        kind: input.kind,
        code: makeCode(6, () => randomInt(0, 1_000_000) / 1_000_000),
        verified_by: ctx.user.id,
      })
      .select("id, name, city, country, code, kind")
      .single();
    if (error?.code === "23505") continue;
    if (error) throw error;
    await audit(ctx, "school.create", `school:${data.id}`, { after: data });
    return ok(data);
  }
  throw new Error("school code");
});
