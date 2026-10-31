import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { SettingsPage } from "@/components/admin/SettingsPage";

export const metadata: Metadata = { title: "Game settings" };

export default async function Page() {
  const { role, allowed } = await pageGate("settings.read");
  if (!allowed) return <Forbidden what="game settings" />;
  return <SettingsPage canWrite={can(role, "settings.write")} />;
}
