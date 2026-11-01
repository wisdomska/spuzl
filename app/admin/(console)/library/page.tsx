import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { LibraryMetaPage } from "@/components/admin/LibraryMetaPage";

export const metadata: Metadata = { title: "Library" };

export default async function Page() {
  const { role, allowed } = await pageGate("content.read");
  if (!allowed) return <Forbidden what="Library metadata" />;
  return <LibraryMetaPage canWrite={can(role, "content.write")} />;
}
