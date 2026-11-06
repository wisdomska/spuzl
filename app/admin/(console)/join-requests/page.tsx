import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { Forbidden } from "@/components/admin/ui";
import { JoinRequestsPage } from "@/components/admin/JoinRequestsPage";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.joinRequests.title };

export default async function Page() {
  const { allowed } = await pageGate("joinlog.read");
  if (!allowed) return <Forbidden what={P.joinRequests.what} />;
  return <JoinRequestsPage />;
}
