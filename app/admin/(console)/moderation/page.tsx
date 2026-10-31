import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { ModerationQueue } from "@/components/admin/ModerationQueue";

export const metadata: Metadata = { title: "Moderation" };

export default async function Page() {
  const { role, allowed } = await pageGate("moderation.read");
  if (!allowed) return <Forbidden what="moderation" />;
  return <ModerationQueue canWrite={can(role, "moderation.write")} />;
}
