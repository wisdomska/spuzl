import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { CalendarView } from "@/components/admin/CalendarView";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.calendar.title };

export default async function Page() {
  const { role, allowed } = await pageGate("calendar.read");
  if (!allowed) return <Forbidden what={P.calendar.what} />;
  return <CalendarView canWrite={can(role, "calendar.write")} />;
}
