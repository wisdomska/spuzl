import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WORLD_BY_ID, type WorldId } from "@/lib/catalog";
import { WorldScreen } from "@/components/world/WorldScreen";

export async function generateMetadata({ params }: PageProps<"/world/[id]">): Promise<Metadata> {
  const { id } = await params;
  const w = WORLD_BY_ID[id as WorldId];
  return w ? { title: w.name, description: `${w.tagline}. Daily puzzles and endless free play.` } : {};
}

export default async function World({ params }: PageProps<"/world/[id]">) {
  const { id } = await params;
  if (!WORLD_BY_ID[id as WorldId]) notFound();
  return <WorldScreen id={id as WorldId} />;
}
