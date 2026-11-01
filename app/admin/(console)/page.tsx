import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Overview } from "@/components/admin/Overview";

export const metadata: Metadata = { title: "Overview" };

/** /admin: the overview for roles that can see players; everyone else opens the first tool their role can use. */
export default async function Page() {
  const { role } = await pageGate();
  if (can(role, "players.read")) return <Overview canModerate={can(role, "moderation.read")} />;
  redirect(can(role, "calendar.read") ? "/admin/calendar" : "/admin/liveops");
}
