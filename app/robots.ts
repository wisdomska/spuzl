import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL || "https://spuzl.vercel.app";

/** Crawl the public pages; keep the admin console, the API and per-player pages out of search results. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/u/", "/bay/", "/party/", "/duel/", "/challenge/", "/i/"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
