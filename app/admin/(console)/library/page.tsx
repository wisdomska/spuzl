import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { LibraryMetaPage } from "@/components/admin/LibraryMetaPage";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.library.title };

export default async function Page() {
  const { role, allowed } = await pageGate("content.read");
  if (!allowed) return <Forbidden what={P.library.what} />;
  return <LibraryMetaPage canWrite={can(role, "content.write")} />;
}
