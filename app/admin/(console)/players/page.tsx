import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { PlayersPage } from "@/components/admin/PlayersPage";

export const metadata: Metadata = { title: "Players" };

export default async function Page() {
  const { role, allowed } = await pageGate("players.read");
  if (!allowed) return <Forbidden what="players" />;
  return (
    <PlayersPage
      canModerate={can(role, "players.moderate")}
      canExport={can(role, "players.export")}
      emailVisible={can(role, "players.pii")}
    />
  );
}
