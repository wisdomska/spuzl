import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { LiveOps } from "@/components/admin/LiveOps";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.liveops.title };

export default async function Page() {
  const { role, allowed } = await pageGate("liveops.read");
  if (!allowed) return <Forbidden what={P.liveops.what} />;
  return <LiveOps canLock={can(role, "calendar.write")} canModerate={can(role, "moderation.read")} />;
}
