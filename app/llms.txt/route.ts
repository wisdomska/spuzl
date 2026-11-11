import { llmsTxt } from "@/lib/seo/llms";
import { servedCopy } from "@/lib/games-meta/server";
import { servedLabSwitch } from "@/lib/game-settings/server";

/** GET /llms.txt (llmstxt.org): SPUZL in brief for AI assistants, with links to every game page. Built at build time. */
export const dynamic = "force-static";
/** R4-10: carries the admin's rule and card copy; rebuilt at most hourly, and at once after a copy change. */
export const revalidate = 3600;

export async function GET() {
  return new Response(llmsTxt(await servedCopy(), await servedLabSwitch()), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
