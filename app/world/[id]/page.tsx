import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { MERGED_WORLDS, WORLD_BY_ID, isLiveWorld, type WorldId } from "@/lib/catalog";
import { WorldScreen } from "@/components/world/WorldScreen";
import { PublicWorld } from "@/components/seo/PublicWorld";
import { SeedQueries } from "@/components/shell/SeedQueries";
import { hasSessionCookie } from "@/lib/auth/session-cookie";
import { hasSupabase } from "@/lib/supabase/env";
import { seoMeta } from "@/lib/copy/seo";
import { publicMetadata } from "@/lib/seo/site";
import { getGameSettings } from "@/lib/game-settings/server";
import { publicGamesInWorld } from "@/lib/seo/games";

export async function generateMetadata({ params }: PageProps<"/world/[id]">): Promise<Metadata> {
  const { id } = await params;
  const w = isLiveWorld(id) ? WORLD_BY_ID[id as WorldId] : undefined;
  if (!w) return {};
  const count = publicGamesInWorld(w.id, await getGameSettings()).length;
  return publicMetadata({ path: `/world/${w.id}`, ...seoMeta.world(w.name, w.tagline, count) });
}

/**
 * A world. Players (a session cookie) get the World screen as before; visitors and crawlers get its public page: the
 * world's games, each linking to its page (/games/<id>), with no client data to wait for.
 */
export default async function World({ params }: PageProps<"/world/[id]">) {
  const { id } = await params;
  // Worlds folded into a broader one (Line Lane into Puzzles, Rage Ridge into Arcade...) send old links on. proxy.ts
  // answers both (308, and a real 404 for unknown worlds) before the page streams; these are the fallbacks.
  const merged = Object.hasOwn(MERGED_WORLDS, id) ? MERGED_WORLDS[id as WorldId] : undefined;
  if (merged && isLiveWorld(merged)) permanentRedirect(`/world/${merged}`);
  // Unknown worlds and worlds whose games are all retired (Number Den) are not found.
  if (!isLiveWorld(id)) notFound();
  // Local demo mode (no backend) keeps the World screen for everyone.
  if (hasSupabase() && !hasSessionCookie(await cookies())) return <PublicWorld id={id as WorldId} lab={await getGameSettings()} />;
  return (
    <SeedQueries>
      <WorldScreen id={id as WorldId} />
    </SeedQueries>
  );
}
