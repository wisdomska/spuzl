import { llmsTxt } from "@/lib/seo/llms";

/** GET /llms.txt (llmstxt.org): SPUZL in brief for AI assistants, with links to every game page. Built at build time. */
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
