import { siteOgCopy } from "@/lib/copy/seo";
import { SEO_CARD_SIZE, SiteSeoCard, renderSeoCard } from "@/lib/og/SeoCard";

/** The site's default link preview (every page without its own): wordmark, Spuz waving, what SPUZL is. Static. */
export const alt = siteOgCopy.alt;
export const size = SEO_CARD_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderSeoCard(<SiteSeoCard title={siteOgCopy.title} line={siteOgCopy.line} foot={siteOgCopy.foot} />);
}
