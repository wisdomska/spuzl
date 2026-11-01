import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { Forbidden } from "@/components/admin/ui";
import { TeamPage } from "@/components/admin/OpsPages";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.team.title };

export default async function Page() {
  const { allowed } = await pageGate("team.manage");
  if (!allowed) return <Forbidden what={P.team.what} />;
  return <TeamPage />;
}
