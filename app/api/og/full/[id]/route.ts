import { cardRoute } from "@/lib/og/route";
import { attemptCard } from "@/lib/share/cards";

/** GET /api/og/full/:attemptId: Full Spuzl card for the day of any of the player's cleared Dailies. */
export const GET = cardRoute((admin, id) => attemptCard(admin, id, "full"));
