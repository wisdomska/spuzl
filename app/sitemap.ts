import type { MetadataRoute } from "next";
import { WORLDS } from "@/lib/catalog";

const site = process.env.NEXT_PUBLIC_SITE_URL || "https://spuzl.vercel.app";

/** Public pages for search engines: the landing page, the info pages, the game library and each group of games. */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, changeFrequency: "weekly" | "monthly" | "yearly", priority: number) => ({
    url: `${site}${path}`,
    changeFrequency,
    priority,
  });
  return [
    page("/", "weekly", 1),
    page("/library", "weekly", 0.8),
    ...WORLDS.map((w) => page(`/world/${w.id}`, "weekly", 0.7)),
    page("/how-to-play", "monthly", 0.6),
    page("/fair-play", "yearly", 0.4),
    page("/privacy", "yearly", 0.4),
    page("/terms", "yearly", 0.3),
    page("/contact", "yearly", 0.3),
  ];
}
