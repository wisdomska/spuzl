import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { ShopPage } from "@/components/admin/OpsPages";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.shop.title };

export default async function Page() {
  const { role, allowed } = await pageGate("catalog.read");
  if (!allowed) return <Forbidden what={P.shop.what} />;
  return <ShopPage canWrite={can(role, "catalog.write")} canPrice={can(role, "prices.write")} canWriteEvents={can(role, "events.write")} />;
}
