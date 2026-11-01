import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { Forbidden } from "@/components/admin/ui";
import { MetricsPage } from "@/components/admin/MetricsPage";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.metrics.title };

export default async function Page() {
  const { allowed } = await pageGate("metrics.read");
  if (!allowed) return <Forbidden what={P.metrics.what} />;
  return <MetricsPage />;
}
