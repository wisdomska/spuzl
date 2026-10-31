import { handle, ok } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { PERMISSIONS, can, type Permission } from "@/lib/admin/roles";

/** GET /api/admin/me: the signed-in admin, their role, what it allows and the sidebar counts. AAL2 like every admin route. */
export const GET = handle(async () => {
  const ctx = await requireAdmin();
  const permissions = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(ctx.role, p));
  const head = { count: "exact" as const, head: true };
  const [puzzles, reports, flagged, schools] = await Promise.all([
    ctx.db.from("puzzles").select("id", head),
    can(ctx.role, "moderation.read") ? ctx.db.from("reports").select("id", head).eq("status", "open") : null,
    can(ctx.role, "moderation.read") ? ctx.db.from("attempts").select("id", head).eq("status", "flagged") : null,
    can(ctx.role, "schools.read") ? ctx.db.from("schools").select("id", head).is("verified_by", null) : null,
  ]);
  return ok({
    id: ctx.user.id,
    email: ctx.email,
    role: ctx.role,
    permissions,
    counts: {
      puzzles: puzzles.count ?? 0,
      moderation: reports && flagged ? (reports.count ?? 0) + (flagged.count ?? 0) : null,
      schools: schools ? (schools.count ?? 0) : null,
    },
  });
});

/** POST /api/admin/me: records that TOTP is enrolled (reaching here at AAL2 proves it). */
export const POST = handle(async () => {
  const ctx = await requireAdmin();
  const { data } = await ctx.db.from("admins").select("totp_enrolled").eq("user_id", ctx.user.id).single();
  if (!data?.totp_enrolled) {
    await ctx.db
      .from("admins")
      .update({ totp_enrolled: true, email: ctx.user.email ?? null })
      .eq("user_id", ctx.user.id);
    await ctx.db
      .from("audit_log")
      .insert({ actor_id: ctx.user.id, action: "admin.totp_enrolled", target: `admin:${ctx.user.id}`, detail: { role: ctx.role } });
  }
  return ok({ ok: true });
});
