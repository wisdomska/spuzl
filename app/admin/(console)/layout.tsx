import { pageGate } from "@/lib/admin/page-gate";
import { AdminShell } from "@/components/admin/AdminShell";

/** Every console page needs an admin at AAL2 (password + TOTP). Pages add their own permission check. */
export default async function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  const { role, email } = await pageGate();
  return (
    <AdminShell role={role} email={email}>
      {children}
    </AdminShell>
  );
}
