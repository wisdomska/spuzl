import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { can, isRole, type Permission, type Role } from "./roles";
import { ADMIN_COOKIE, aalOf, sessionIdOf } from "./session";

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
export async function adminIdentity(): Promise<{ user: User; aal: "aal1" | "aal2" | null; sessionId: string | null } | null> {
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
  return { user: data.user, aal: aalOf(token), sessionId: sessionIdOf(token) };
}

export type GateResult =
  { ok: true; ctx: AdminCtx } | { ok: false; status: 401 | 403; code: "unauthenticated" | "not_admin" | "aal2_required" | "forbidden" };

/**
 * The admin gate. Order: signed in (401), listed in `admins` and not disabled (403 not_admin),
 * second step done for this sign-in session (403 aal2_required): an emailed code (admin_verified_sessions), or an
 * authenticator (aal2) for accounts and tests that still use one, then role holds the permission (403 forbidden).
 */
export async function checkAdmin(permission?: Permission): Promise<GateResult> {
  const who = await adminIdentity();
  if (!who) return { ok: false, status: 401, code: "unauthenticated" };
  const db = supabaseAdmin();
  const { data: row } = await db.from("admins").select("role, disabled_at, email").eq("user_id", who.user.id).maybeSingle();
  if (!row || row.disabled_at || !isRole(row.role)) return { ok: false, status: 403, code: "not_admin" };
  if (who.aal !== "aal2" && !(await sessionVerified(db, who.user.id, who.sessionId)))
    return { ok: false, status: 403, code: "aal2_required" };
  if (permission && !can(row.role, permission)) return { ok: false, status: 403, code: "forbidden" };
  return { ok: true, ctx: { user: who.user, role: row.role, email: row.email ?? who.user.email ?? null, db } };
}

/** How long a verified admin sign-in lasts without use. Every admin request slides it forward. */
export const ADMIN_IDLE_MS = 7 * 24 * 3600_000;

/**
 * True when this sign-in session passed the emailed code step and hasn't gone a week unused. Each check slides the
 * expiry to a week from now (at most once an hour), so an admin who keeps using the console stays signed in.
 */
async function sessionVerified(db: SupabaseClient, userId: string, sessionId: string | null): Promise<boolean> {
  if (!sessionId) return false;
  const now = Date.now();
  const { data } = await db
    .from("admin_verified_sessions")
    .select("session_id, expires_at")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .gt("expires_at", new Date(now).toISOString())
    .maybeSingle();
  if (!data) return false;
  if (Date.parse(data.expires_at as string) < now + ADMIN_IDLE_MS - 3600_000)
    await db
      .from("admin_verified_sessions")
      .update({ expires_at: new Date(now + ADMIN_IDLE_MS).toISOString() })
      .eq("session_id", sessionId)
      .eq("user_id", userId);
  return true;
}

/**
 * The first gate for the code step: signed in with a password and listed as an active admin, second step not
 * needed yet. Returns the identity or throws.
 */
export async function requirePasswordAdmin(): Promise<{ user: User; sessionId: string; db: SupabaseClient; role: Role }> {
  const who = await adminIdentity();
  if (!who || !who.sessionId || !who.user.email) throw new ApiError(401, "unauthenticated");
  const db = supabaseAdmin();
  const { data: row } = await db.from("admins").select("role, disabled_at").eq("user_id", who.user.id).maybeSingle();
  if (!row || row.disabled_at || !isRole(row.role)) throw new ApiError(403, "not_admin");
  return { user: who.user, sessionId: who.sessionId, db, role: row.role };
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
