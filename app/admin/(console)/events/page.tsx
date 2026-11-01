import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { EventsPage } from "@/components/admin/EventsPage";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.events.title };

export default async function Page() {
  const { role, allowed } = await pageGate("events.read");
  if (!allowed) return <Forbidden what={P.events.what} />;
  return <EventsPage canWrite={can(role, "events.write")} />;
}
