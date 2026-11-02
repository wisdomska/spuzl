import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { MERGED_WORLDS, WORLD_BY_ID, isLiveWorld, type WorldId } from "@/lib/catalog";
import { WorldScreen } from "@/components/world/WorldScreen";

export async function generateMetadata({ params }: PageProps<"/world/[id]">): Promise<Metadata> {
  const { id } = await params;
  const w = isLiveWorld(id) ? WORLD_BY_ID[id as WorldId] : undefined;
  return w ? { title: w.name, description: `${w.tagline}. Endless puzzles to play any time.` } : {};
}

export default async function World({ params }: PageProps<"/world/[id]">) {
  const { id } = await params;
  // Worlds folded into a broader one (Line Lane into Puzzles, Rage Ridge into Arcade...) send old links on.
  const merged = Object.hasOwn(MERGED_WORLDS, id) ? MERGED_WORLDS[id as WorldId] : undefined;
  if (merged && isLiveWorld(merged)) permanentRedirect(`/world/${merged}`);
  // Unknown worlds and worlds whose games are all retired (Number Den) are not found.
  if (!isLiveWorld(id)) notFound();
  return <WorldScreen id={id as WorldId} />;
}
