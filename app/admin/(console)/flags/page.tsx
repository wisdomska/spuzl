import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { FlagsPage } from "@/components/admin/OpsPages";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.flags.title };

export default async function Page() {
  const { role, allowed } = await pageGate("flags.read");
  if (!allowed) return <Forbidden what={P.flags.what} />;
  return <FlagsPage canWrite={can(role, "flags.write")} />;
}
