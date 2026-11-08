import { llmsFullTxt } from "@/lib/seo/llms";

/** GET /llms-full.txt: every game in full, the FAQ and the under-16 safety rules as one plain-text file. Static. */
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsFullTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
