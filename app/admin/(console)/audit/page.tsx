import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { Forbidden } from "@/components/admin/ui";
import { AuditPage } from "@/components/admin/OpsPages";

export const metadata: Metadata = { title: "Audit log" };

export default async function Page() {
  const { allowed } = await pageGate("audit.read");
  if (!allowed) return <Forbidden what="the audit log" />;
  return <AuditPage />;
}
