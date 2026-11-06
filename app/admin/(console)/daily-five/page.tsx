import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { DailyFivePage } from "@/components/admin/DailyFivePage";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.dailyFive.title };

export default async function Page() {
  const { role, allowed } = await pageGate("dailyFive.read");
  if (!allowed) return <Forbidden what={P.dailyFive.what} />;
  return <DailyFivePage canWrite={can(role, "dailyFive.write")} />;
}
