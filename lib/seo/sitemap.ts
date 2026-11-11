import type { MetadataRoute } from "next";
import { WORLDS, type LabSwitch } from "@/lib/catalog";
import { absoluteUrl } from "./site";
import { LIVE_ONLY, publicGames } from "./games";

/**
 * Public pages for search engines: the home page (the visitor landing page), the game catalogue and every live
 * game's page (and each lab game's while it is switched on for players), the live worlds (never a folded world,
 * which redirects), All games and the info pages. /about is left out: it is the same page as "/" and its canonical
 * points there. app/sitemap.ts serves it with the current lab switch.
 */
export function sitemapEntries(lab: LabSwitch = LIVE_ONLY): MetadataRoute.Sitemap {
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
    ...publicGames(lab).map((g) => page(`/games/${g.id}`, "monthly", 0.8)),
    ...WORLDS.map((w) => page(`/world/${w.id}`, "weekly", 0.7)),
    page("/library", "weekly", 0.6),
    page("/how-to-play", "monthly", 0.6),
    page("/fair-play", "yearly", 0.4),
    page("/privacy", "yearly", 0.4),
    page("/terms", "yearly", 0.3),
    page("/contact", "yearly", 0.3),
  ];
}
