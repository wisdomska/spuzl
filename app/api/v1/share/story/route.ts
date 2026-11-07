import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { getGameSettings } from "@/lib/game-settings/server";
import { createChallenge } from "@/lib/multiplayer/server/async";
import { loadChallengeCard } from "@/lib/share/challenge";
import { CHALLENGE_SIZES, challengePath } from "@/lib/share/challenge-card";
import { SHARE_DOMAIN } from "@/lib/share/text";
import { storyCopy } from "@/lib/copy/share";

const Story = z.object({ attemptId: z.string().uuid() });

/**
 * POST /api/v1/share/story: the 9:16 story card for one of the player's verified clears. Makes (or reuses) the
 * friend challenge on the same puzzle with `createChallenge`, so the card's "Beat me" short link always opens
 * that exact board. 404 while "features.storyCards" or "features.challenges" is off; 409 for a clear that isn't
 * verified; 404 for someone else's attempt.
 */
export const POST = handle(async (req: Request) => {
  if (!(await getGameSettings())["features.storyCards"]) throw new ApiError(404, "story_cards_off");
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `story:${player.id}`, 30, 600);
  const { attemptId } = await body(req, Story);
  const { code } = await createChallenge(admin, player.id, attemptId);
  const card = await loadChallengeCard(admin, code);
  if (!card) throw new ApiError(404, "not_found");
  const path = challengePath(code);
  return ok({
    code,
    path,
    image: `/api/og/challenge/${code}?format=story`,
    ...CHALLENGE_SIZES.story,
    text: storyCopy.text(card.kicker, card.big, `${SHARE_DOMAIN}${path}`),
    alt: storyCopy.alt(card.kicker, card.big),
  });
});
