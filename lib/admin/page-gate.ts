import "server-only";
import { redirect } from "next/navigation";
import { checkAdmin } from "./auth";
import { can, type Permission, type Role } from "./roles";

/**
 * Server gate for /admin pages: no admin session at AAL2 goes back to the login (which resumes at the
 * right step). Returns the role and whether it holds `permission`, so the page can show a Forbidden panel.
 */
export async function pageGate(permission?: Permission): Promise<{ role: Role; email: string | null; allowed: boolean }> {
  const r = await checkAdmin();
  if (!r.ok) redirect(r.code === "unauthenticated" ? "/admin/login" : `/admin/login?e=${r.code}`);
  return { role: r.ctx.role, email: r.ctx.email, allowed: permission ? can(r.ctx.role, permission) : true };
}
