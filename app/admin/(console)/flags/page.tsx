import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { FlagsPage } from "@/components/admin/OpsPages";

export const metadata: Metadata = { title: "Feature flags" };

export default async function Page() {
  const { role, allowed } = await pageGate("flags.read");
  if (!allowed) return <Forbidden what="feature flags" />;
  return <FlagsPage canWrite={can(role, "flags.write")} />;
}
