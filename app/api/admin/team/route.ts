import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { ROLES } from "@/lib/admin/roles";
import { provisionAdmin, resetRedirect } from "@/lib/admin/provision";
import { fetchPage, pageParams } from "@/lib/admin/paging";

const site = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * GET /api/admin/team?page=&pageSize=: one page of admins, newest first (user id breaks ties), with role,
 * TOTP status and last sign-in (owner only).
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("team.manage");
  const p = pageParams(req);
  const { rows: data, total } = await fetchPage(
    () =>
      ctx.db
        .from("admins")
        .select("user_id, role, email, totp_enrolled, disabled_at, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .order("user_id", { ascending: false }),
    p,
  );
  const rows = await Promise.all(
    data.map(async (a) => {
      const { data: u } = await ctx.db.auth.admin.getUserById(a.user_id);
      return { ...a, email: a.email ?? u.user?.email ?? null, last_sign_in_at: u.user?.last_sign_in_at ?? null };
    }),
  );
  return ok({ me: ctx.user.id, rows, page: p.page, pageSize: p.pageSize, total });
});

const Add = z.object({ email: z.string().email().max(200), role: z.enum(ROLES) });

/** POST /api/admin/team: adds an admin by email. They get a password-reset email and enrol TOTP on first sign-in. */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("team.manage");
  const { email, role } = await body(req, Add);
  if (email.toLowerCase() === (ctx.email ?? "").toLowerCase()) throw new ApiError(409, "self");
  const r = await provisionAdmin(ctx.db, { email, role, addedBy: ctx.user.id, redirectTo: resetRedirect(site()), resend: true });
  return ok(r);
});
