import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { LiveOps } from "@/components/admin/LiveOps";

export const metadata: Metadata = { title: "Live ops" };

export default async function Page() {
  const { role, allowed } = await pageGate("liveops.read");
  if (!allowed) return <Forbidden what="live ops" />;
  return <LiveOps canLock={can(role, "calendar.write")} canModerate={can(role, "moderation.read")} />;
}
