import { cardRoute } from "@/lib/og/route";
import { attemptCard } from "@/lib/share/cards";

/**
 * GET /api/og/free/:attemptId?format=story|square&size=small: a free-play clear's card (R4-20), the share image while
 * story cards ("features.storyCards") are off. Verified free-play clears only; anything else is a 404 image.
 */
export const GET = cardRoute((admin, id) => attemptCard(admin, id, "free"));
