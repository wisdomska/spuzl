import { GAMES } from "@/lib/catalog";
import { gamesCopy } from "@/lib/copy/seo";
import { publicGame } from "@/lib/seo/games";
import { GameSeoCard, SEO_CARD_SIZE, renderSeoCard } from "@/lib/og/SeoCard";
import { notFoundImage } from "@/lib/og/render";

/** Each game page's link preview: the game's tile in its world colour, its name, its rule and "Play free". Static. */
export const alt = "A SPUZL game: its name, world and rule";
export const size = SEO_CARD_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = publicGame(id);
  if (!g) return notFoundImage();
  return renderSeoCard(<GameSeoCard game={g} label={{ play: gamesCopy.cta(g.name), free: gamesCopy.ogFoot }} />);
}
