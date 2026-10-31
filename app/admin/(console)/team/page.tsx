import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { Forbidden } from "@/components/admin/ui";
import { TeamPage } from "@/components/admin/OpsPages";

export const metadata: Metadata = { title: "Team" };

export default async function Page() {
  const { allowed } = await pageGate("team.manage");
  if (!allowed) return <Forbidden what="team settings" />;
  return <TeamPage />;
}
