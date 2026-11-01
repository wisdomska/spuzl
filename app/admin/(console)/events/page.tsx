import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { EventsPage } from "@/components/admin/EventsPage";

export const metadata: Metadata = { title: "Seasonal events" };

export default async function Page() {
  const { role, allowed } = await pageGate("events.read");
  if (!allowed) return <Forbidden what="seasonal events" />;
  return <EventsPage canWrite={can(role, "events.write")} />;
}
