import { redirect } from "next/navigation";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";

/** /admin opens the first tool the role can use. */
export default async function Page() {
  const { role } = await pageGate();
  redirect(can(role, "calendar.read") ? "/admin/calendar" : "/admin/liveops");
}
