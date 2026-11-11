import { GAMES } from "@/lib/catalog";
import { gamesCopy } from "@/lib/copy/seo";
import { publicGame } from "@/lib/seo/games";
import { GameSeoCard, SEO_CARD_SIZE, renderSeoCard } from "@/lib/og/SeoCard";
import { notFoundImage } from "@/lib/og/render";
import { servedCopy } from "@/lib/games-meta/server";
import { servedGameSwitch } from "@/lib/game-settings/server";

/** Each game page's link preview: the game's tile in its world colour, its name, its rule and "Play free". Static. */
export const alt = "A SPUZL game: its name, world and rule";
export const size = SEO_CARD_SIZE;
export const contentType = "image/png";
/** R4-10: the rule on the card is the admin's (Library page); rebuilt at most hourly or after a copy change. */
export const revalidate = 3600;

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pg = publicGame(id, await servedGameSwitch());
  if (!pg) return notFoundImage();
  const g = (await servedCopy())(pg);
  return renderSeoCard(<GameSeoCard game={g} label={{ play: gamesCopy.cta(g.name), free: gamesCopy.ogFoot }} />);
}
