import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { SchoolsPage } from "@/components/admin/OpsPages";

export const metadata: Metadata = { title: "Schools" };

export default async function Page() {
  const { role, allowed } = await pageGate("schools.read");
  if (!allowed) return <Forbidden what="schools" />;
  return <SchoolsPage canWrite={can(role, "schools.write")} />;
}
