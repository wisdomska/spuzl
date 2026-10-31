import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { can, isRole, type Permission, type Role } from "./roles";
import { ADMIN_COOKIE, aalOf } from "./session";

export interface AdminCtx {
  user: User;
  role: Role;
  email: string | null;
  /** service-role client: use only after this gate has passed */
  db: SupabaseClient;
}

/** Cookie-bound client for the admin session (separate cookie from the player's). */
export async function adminAuthClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: { name: ADMIN_COOKIE },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Server Component render: the browser client refreshes the token instead */
        }
      },
    },
  });
}

/**
 * The verified admin user and assurance level for this request, from a Bearer token (API clients and tests)
 * or the admin session cookie. The JWT is validated by Supabase Auth before its `aal` claim is trusted.
 */
export async function adminIdentity(): Promise<{ user: User; aal: "aal1" | "aal2" | null } | null> {
  const auth = (await headers()).get("authorization");
  let token: string | null = null;
  let sb: SupabaseClient;
  if (auth?.startsWith("Bearer ")) {
    token = auth.slice(7);
    sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: () => {} } });
  } else {
    sb = await adminAuthClient();
    const { data } = await sb.auth.getSession();
    token = data.session?.access_token ?? null;
  }
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, aal: aalOf(token) };
}

export type GateResult =
  { ok: true; ctx: AdminCtx } | { ok: false; status: 401 | 403; code: "unauthenticated" | "not_admin" | "aal2_required" | "forbidden" };

/**
 * The admin gate. Order: signed in (401), listed in `admins` and not disabled (403 not_admin),
 * TOTP second factor verified this session (403 aal2_required), role holds the permission (403 forbidden).
 */
export async function checkAdmin(permission?: Permission): Promise<GateResult> {
  const who = await adminIdentity();
  if (!who) return { ok: false, status: 401, code: "unauthenticated" };
  const db = supabaseAdmin();
  const { data: row } = await db.from("admins").select("role, disabled_at, email").eq("user_id", who.user.id).maybeSingle();
  if (!row || row.disabled_at || !isRole(row.role)) return { ok: false, status: 403, code: "not_admin" };
  if (who.aal !== "aal2") return { ok: false, status: 403, code: "aal2_required" };
  if (permission && !can(row.role, permission)) return { ok: false, status: 403, code: "forbidden" };
  return { ok: true, ctx: { user: who.user, role: row.role, email: row.email ?? who.user.email ?? null, db } };
}

/** Route-handler gate: throws ApiError so `handle` maps it to JSON. */
export async function requireAdmin(permission?: Permission): Promise<AdminCtx> {
  const r = await checkAdmin(permission);
  if (!r.ok) throw new ApiError(r.status, r.code);
  return r.ctx;
}

/** Appends to the audit log (FR-AD-08). Every admin write calls this, or a SQL function that does. */
export async function audit(ctx: Pick<AdminCtx, "db" | "user" | "role">, action: string, target: string | null, detail: object = {}) {
  const { error } = await ctx.db.from("audit_log").insert({ actor_id: ctx.user.id, action, target, detail: { ...detail, role: ctx.role } });
  if (error) throw error;
}
