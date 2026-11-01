import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { SettingsPage } from "@/components/admin/SettingsPage";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.settings.title };

export default async function Page() {
  const { role, allowed } = await pageGate("settings.read");
  if (!allowed) return <Forbidden what={P.settings.what} />;
  return <SettingsPage canWrite={can(role, "settings.write")} />;
}
