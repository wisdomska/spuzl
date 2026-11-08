/**
 * Schema.org structured data (JSON-LD) for search engines and AI answers. Plain objects, so tests can parse and
 * check them; `jsonLdScript` serialises one for a <script type="application/ld+json"> tag with "<" escaped (the
 * XSS guard the Next.js JSON-LD guide asks for).
 */
import { GAME_COUNT, WORLD_BY_ID, type GameMeta } from "@/lib/catalog";
import { WORLD_GENRES, type QA } from "@/lib/copy/seo";
import { siteCopy } from "@/lib/copy/site";
import { aboutCopy } from "@/lib/copy/about";
import { SITE_URL, absoluteUrl } from "./site";
import type { GameFacts } from "./games";

type Thing = Record<string, unknown>;
const CONTEXT = "https://schema.org";

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

/** The publisher: SPUZL itself, with its app icon as the logo. */
export const organization = (): Thing => ({
  "@type": "Organization",
  "@id": ORG_ID,
  name: "SPUZL",
  url: absoluteUrl("/"),
  logo: { "@type": "ImageObject", url: absoluteUrl("/icon.png"), width: 192, height: 192 },
  sameAs: [aboutCopy.creditUrl],
});

export const website = (): Thing => ({
  "@type": "WebSite",
  "@id": SITE_ID,
  name: "SPUZL",
  url: absoluteUrl("/"),
  description: siteCopy.description,
  inLanguage: "en",
  publisher: { "@id": ORG_ID },
});

const FREE_OFFER = { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" };

/** The app: a free browser game app that runs anywhere. */
export const webApplication = (): Thing => ({
  "@type": "WebApplication",
  "@id": `${SITE_URL}/#app`,
  name: "SPUZL",
  url: absoluteUrl("/"),
  description: `${siteCopy.description} ${GAME_COUNT} free games in your browser.`,
  applicationCategory: "GameApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with JavaScript.",
  inLanguage: "en",
  isAccessibleForFree: true,
  offers: FREE_OFFER,
  publisher: { "@id": ORG_ID },
});

/** One game page: a free web browser game. */
export function videoGame(f: GameFacts): Thing {
  const g: GameMeta = f.game;
  const url = absoluteUrl(`/games/${g.id}`);
  return {
    "@type": "VideoGame",
    "@id": `${url}#game`,
    name: g.name,
    description: f.definition,
    url,
    image: absoluteUrl(`/games/${g.id}/opengraph-image`),
    genre: WORLD_GENRES[g.world],
    gamePlatform: "Web browser",
    applicationCategory: "Game",
    operatingSystem: "Any",
    playMode: f.modes.some((m) => m === "duel" || m === "party" || m === "bay") ? ["SinglePlayer", "MultiPlayer"] : "SinglePlayer",
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: { ...FREE_OFFER, url },
    isPartOf: { "@type": "WebSite", "@id": SITE_ID, name: "SPUZL" },
    about: WORLD_BY_ID[g.world].name,
    publisher: { "@type": "Organization", "@id": ORG_ID, name: "SPUZL", url: absoluteUrl("/") },
  };
}

/** Breadcrumbs from [name, path] pairs, first to last. */
export const breadcrumbs = (items: readonly (readonly [string, string])[]): Thing => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: absoluteUrl(path) })),
});

export const faqPage = (qas: readonly QA[]): Thing => ({
  "@type": "FAQPage",
  mainEntity: qas.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
});

/** A list of game pages (the /games catalogue and world pages). */
export const gameList = (name: string, games: readonly GameMeta[]): Thing => ({
  "@type": "ItemList",
  name,
  numberOfItems: games.length,
  itemListElement: games.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.name, url: absoluteUrl(`/games/${g.id}`) })),
});

/** One JSON-LD document holding several nodes. */
export const graph = (...nodes: Thing[]): Thing => ({ "@context": CONTEXT, "@graph": nodes });

/** Safe text for a JSON-LD <script>: "<" can never close the tag early. */
export const jsonLdScript = (data: Thing) => JSON.stringify(data).replace(/</g, "\\u003c");
