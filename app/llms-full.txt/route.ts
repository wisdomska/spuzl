import { llmsFullTxt } from "@/lib/seo/llms";
import { servedCopy } from "@/lib/games-meta/server";
import { servedGameSwitch } from "@/lib/game-settings/server";

/** GET /llms-full.txt: every game in full, the FAQ and the under-16 safety rules as one plain-text file. Static. */
export const dynamic = "force-static";
/** R4-10: carries the admin's rule and card copy; rebuilt at most hourly, and at once after a copy change. */
export const revalidate = 3600;

export async function GET() {
  return new Response(llmsFullTxt(await servedCopy(), await servedGameSwitch()), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
