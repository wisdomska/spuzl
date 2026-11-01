import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { Forbidden } from "@/components/admin/ui";
import { MetricsPage } from "@/components/admin/MetricsPage";

export const metadata: Metadata = { title: "Metrics" };

export default async function Page() {
  const { allowed } = await pageGate("metrics.read");
  if (!allowed) return <Forbidden what="metrics" />;
  return <MetricsPage />;
}
