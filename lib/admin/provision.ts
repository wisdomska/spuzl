/**
 * Creates (or finds) an admin's auth user, records their role, and emails a password-reset link so they
 * choose their own password. No password is ever generated, stored or logged here.
 * Used by the owner bootstrap (script and server path) and by the owner's Team page. Server only: takes a
 * service-role client. Kept free of Next imports so `scripts/bootstrap-owner.mts` can run it with tsx.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "./roles";

export interface ProvisionResult {
  userId: string;
  email: string;
  role: Role;
  createdUser: boolean;
  createdAdmin: boolean;
  roleChanged: boolean;
  resetSent: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findUserByEmail(db: SupabaseClient, email: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * Idempotent. Re-running with the same email changes nothing and sends no second email unless the user has
 * never signed in and `resend` is set (or the user was just created).
 */
export async function provisionAdmin(
  db: SupabaseClient,
  input: { email: string; role: Role; addedBy?: string | null; redirectTo: string; resend?: boolean },
): Promise<ProvisionResult> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new Error("A valid email is required");

  let user = await findUserByEmail(db, email);
  let createdUser = false;
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, app_metadata: { spuzl_admin: true } });
    if (error) {
      // A concurrent run may have created it first.
      user = await findUserByEmail(db, email);
      if (!user) throw error;
    } else {
      user = data.user;
      createdUser = true;
    }
  }

  const { data: existing } = await db.from("admins").select("role").eq("user_id", user.id).maybeSingle();
  let createdAdmin = false;
  let roleChanged = false;
  if (!existing) {
    const { error } = await db.from("admins").insert({ user_id: user.id, role: input.role, email, added_by: input.addedBy ?? null });
    if (error) throw error;
    createdAdmin = true;
  } else if (existing.role !== input.role) {
    const { error } = await db.from("admins").update({ role: input.role, email, disabled_at: null }).eq("user_id", user.id);
    if (error) throw error;
    roleChanged = true;
  }

  let resetSent = false;
  if (createdUser || (input.resend && !user.last_sign_in_at)) {
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: input.redirectTo });
    if (error) throw error;
    resetSent = true;
  }

  if (createdAdmin || roleChanged || resetSent) {
    await db.from("audit_log").insert({
      actor_id: input.addedBy ?? null,
      action: createdAdmin ? "admin.add" : roleChanged ? "admin.role" : "admin.reset_sent",
      target: `admin:${user.id}`,
      detail: { email, role: input.role, created_user: createdUser, reset_sent: resetSent },
    });
  }
  return { userId: user.id, email, role: input.role, createdUser, createdAdmin, roleChanged, resetSent };
}

/** Where password-reset links land: the admin login, which handles the recovery session. */
export const resetRedirect = (siteUrl: string) => `${siteUrl.replace(/\/$/, "")}/admin/login?reset=1`;
