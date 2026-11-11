import "server-only";
import { revalidatePath } from "next/cache";

/**
 * R4-10: after the admin changes a game's rule or card copy, or its state (On, In testing, Off) or its Duels and
 * Parties switch (Games page), the static public pages that show it are rebuilt on their next visit instead of waiting
 * for their hourly revalidation: every game page and its link preview, the games index, How to play, the landing
 * page, the sitemap and llms.txt / llms-full.txt. Players' screens read the copy and the state at runtime already.
 */
export function revalidatePublicCopy() {
  try {
    revalidatePath("/games/[id]", "layout");
    revalidatePath("/games/[id]", "page");
    revalidatePath("/games");
    revalidatePath("/how-to-play");
    revalidatePath("/llms.txt");
    revalidatePath("/llms-full.txt");
    revalidatePath("/sitemap.xml");
    // The landing page (served at "/" to visitors) lists the games and counts them (Games page state).
    revalidatePath("/about");
  } catch {
    // Outside a request (tests, scripts) there is nothing to revalidate; the hourly rebuild still applies.
  }
}
