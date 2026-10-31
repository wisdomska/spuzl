import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { CalendarView } from "@/components/admin/CalendarView";

export const metadata: Metadata = { title: "Content calendar" };

export default async function Page() {
  const { role, allowed } = await pageGate("calendar.read");
  if (!allowed) return <Forbidden what="the calendar" />;
  return <CalendarView canWrite={can(role, "calendar.write")} />;
}
