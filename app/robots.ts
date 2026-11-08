import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/site";
import { AI_CRAWLERS, PRIVATE_PATHS } from "@/lib/seo/crawlers";

/** Crawl the public pages; keep the admin console, the API and per-player pages out. AI crawlers are welcome (GEO). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: AI_CRAWLERS, allow: ["/", "/llms.txt", "/llms-full.txt"], disallow: PRIVATE_PATHS },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
