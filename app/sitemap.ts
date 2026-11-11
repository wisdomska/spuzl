import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/seo/sitemap";
import { servedLabSwitch } from "@/lib/game-settings/server";

/**
 * The sitemap (lib/seo/sitemap.ts), with the lab games switched on for players. Rebuilt hourly and at once after the
 * admin switches lab games (lib/seo/revalidate).
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries(await servedLabSwitch());
}
