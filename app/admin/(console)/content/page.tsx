import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { ContentDesk } from "@/components/admin/ContentDesk";

export const metadata: Metadata = { title: "Content" };

export default async function Page() {
  const { role, allowed } = await pageGate("content.read");
  if (!allowed) return <Forbidden what="the content editor" />;
  return (
    <ContentDesk
      canWrite={can(role, "content.write")}
      canApprove={can(role, "content.approve")}
      canSchedule={can(role, "calendar.write")}
      isOwner={can(role, "content.owner_review")}
    />
  );
}
