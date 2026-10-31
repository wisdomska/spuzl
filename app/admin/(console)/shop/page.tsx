import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { ShopPage } from "@/components/admin/OpsPages";

export const metadata: Metadata = { title: "Shop and events" };

export default async function Page() {
  const { role, allowed } = await pageGate("catalog.read");
  if (!allowed) return <Forbidden what="the shop and events" />;
  return <ShopPage canWrite={can(role, "catalog.write")} canPrice={can(role, "prices.write")} />;
}
