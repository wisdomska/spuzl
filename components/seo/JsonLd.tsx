import { jsonLdScript } from "@/lib/seo/jsonld";

/** Structured data for search engines and AI answers (a plain script tag, as the Next.js JSON-LD guide recommends). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}
