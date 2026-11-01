import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { ModerationQueue } from "@/components/admin/ModerationQueue";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.moderation.title };

export default async function Page() {
  const { role, allowed } = await pageGate("moderation.read");
  if (!allowed) return <Forbidden what={P.moderation.what} />;
  return <ModerationQueue canWrite={can(role, "moderation.write")} />;
}
