import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { ContentDesk } from "@/components/admin/ContentDesk";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.content.title };

export default async function Page() {
  const { role, allowed } = await pageGate("content.read");
  if (!allowed) return <Forbidden what={P.content.what} />;
  return (
    <ContentDesk
      canWrite={can(role, "content.write")}
      canApprove={can(role, "content.approve")}
      canSchedule={can(role, "calendar.write")}
      isOwner={can(role, "content.owner_review")}
    />
  );
}
