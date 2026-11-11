import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/seo/sitemap";
import { servedGameSwitch } from "@/lib/game-settings/server";

/**
 * The sitemap (lib/seo/sitemap.ts), with the games that are On. Rebuilt hourly and at once after the admin changes a
 * game's state on the Games page (lib/seo/revalidate).
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries(await servedGameSwitch());
}
