import type { Metadata } from "next";
import { siteOgCopy } from "@/lib/copy/seo";

/**
 * The public address search engines and AI crawlers should use. NEXT_PUBLIC_SITE_URL wins (preview deployments set
 * their own); production falls back to the live domain. No trailing slash.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://spuzl.vercel.app").replace(/\/+$/, "");

/** An absolute URL on this site for a path ("/games/crownfall" → "https://spuzl.vercel.app/games/crownfall"). */
export const absoluteUrl = (path: string) => `${SITE_URL}${path === "/" ? "/" : path}`;

/** The site's default share image (app/opengraph-image.tsx). */
export const DEFAULT_OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: siteOgCopy.alt };

/** Pages that should never show in search results: private, per-player, one-off or first-run screens. */
export const NOINDEX: NonNullable<Metadata["robots"]> = { index: false, follow: false, googleBot: { index: false, follow: false } };

/**
 * Metadata for a public page: an absolute title (no "· SPUZL" template, the copy already names the brand), the
 * description, its canonical address and matching Open Graph tags with the site's share image. Pass `image: false`
 * when the page has its own opengraph-image file (the file then fills the image in).
 */
export function publicMetadata(o: {
  path: string;
  title: string;
  description: string;
  image?: false;
  type?: "website" | "article";
}): Metadata {
  const og: NonNullable<Metadata["openGraph"]> = {
    type: o.type ?? "website",
    siteName: "SPUZL",
    locale: "en",
    url: o.path,
    title: o.title,
    description: o.description,
  };
  if (o.image !== false) og.images = [DEFAULT_OG_IMAGE];
  return {
    title: { absolute: o.title },
    description: o.description,
    alternates: { canonical: o.path },
    openGraph: og,
  };
}
