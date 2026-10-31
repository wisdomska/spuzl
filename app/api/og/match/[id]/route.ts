import { cardRoute } from "@/lib/og/route";
import { matchCard } from "@/lib/share/cards";

/**
 * GET /api/og/match/:matchId: Duel win (winner's side) or Party podium.
 * `?p=<playerId>` picks whose podium place a Party card shows; it never changes a score.
 */
export const GET = cardRoute((admin, id, url) => matchCard(admin, id, url.searchParams.get("p")));
