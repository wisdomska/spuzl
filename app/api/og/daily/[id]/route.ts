import { cardRoute } from "@/lib/og/route";
import { attemptCard } from "@/lib/share/cards";

/** GET /api/og/daily/:attemptId?format=story|square&size=small: Daily clear card (FR-RS-03). */
export const GET = cardRoute((admin, id) => attemptCard(admin, id, "daily"));
