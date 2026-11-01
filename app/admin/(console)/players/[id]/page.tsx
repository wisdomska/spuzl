import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageGate } from "@/lib/admin/page-gate";
import { listSearch } from "@/lib/admin/url-filters";
import { Forbidden } from "@/components/admin/ui";
import { PlayerDetail } from "@/components/admin/PlayerDetail";

export const metadata: Metadata = { title: "Player" };

export default async function Page({ params, searchParams }: PageProps<"/admin/players/[id]">) {
  const { role, allowed } = await pageGate("players.read");
  if (!allowed) return <Forbidden what="players" />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const back = `/admin/players${listSearch((await searchParams).list)}`;
  return <PlayerDetail id={id} role={role} backHref={back} />;
}
