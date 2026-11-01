import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { Forbidden } from "@/components/admin/ui";
import { AuditPage } from "@/components/admin/OpsPages";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.audit.title };

export default async function Page() {
  const { allowed } = await pageGate("audit.read");
  if (!allowed) return <Forbidden what={P.audit.what} />;
  return <AuditPage />;
}
