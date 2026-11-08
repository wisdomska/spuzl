import type { MetadataRoute } from "next";
import { GAMES, WORLDS } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Public pages for search engines: the home page (the visitor landing page), the game catalogue and every live
 * game's page, the live worlds (never a folded world, which redirects), All games and the info pages. /about is
 * left out: it is the same page as "/" and its canonical points there. Generated at build time, so lastModified
 * is the deploy.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const page = (path: string, changeFrequency: "weekly" | "monthly" | "yearly", priority: number) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency,
    priority,
  });
  return [
    page("/", "weekly", 1),
    page("/games", "weekly", 0.9),
    ...GAMES.map((g) => page(`/games/${g.id}`, "monthly", 0.8)),
    ...WORLDS.map((w) => page(`/world/${w.id}`, "weekly", 0.7)),
    page("/library", "weekly", 0.6),
    page("/how-to-play", "monthly", 0.6),
    page("/fair-play", "yearly", 0.4),
    page("/privacy", "yearly", 0.4),
    page("/terms", "yearly", 0.3),
    page("/contact", "yearly", 0.3),
  ];
}
