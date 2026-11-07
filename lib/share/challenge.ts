import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_BY_ID, playableGame, toneOf } from "@/lib/catalog";
import { getGameSettings } from "@/lib/game-settings/server";
import { challengeCard, challengeCodeOf, type ChallengeCardModel } from "./challenge-card";
import { SHARE_DOMAIN } from "./text";

/**
 * The challenge card for a code, from the challenge row and the sender's player row (nickname, colour, equipped
 * hat; never city, level, school or age). Null while "features.challenges" is off, for an unknown, expired or
 * retired-game challenge, or a banned sender: link previews then fall back to the site card.
 */
export async function loadChallengeCard(admin: SupabaseClient, raw: string): Promise<ChallengeCardModel | null> {
  const code = challengeCodeOf(raw);
  if (!code) return null;
  if (!(await getGameSettings())["features.challenges"]) return null;
  const { data: c } = await admin
    .from("challenges")
    .select("code, sender_id, game_id, sender_ms, expires_at")
    .eq("code", code)
    .maybeSingle();
  if (!c || Date.parse(c.expires_at) < Date.now() || !playableGame(c.game_id)) return null;
  const { data: p } = await admin.from("players").select("nickname, avatar_color, hat, banned_at").eq("id", c.sender_id).maybeSingle();
  if (!p || p.banned_at) return null;
  const meta = GAME_BY_ID[c.game_id];
  return challengeCard({
    code: c.code,
    nickname: p.nickname,
    color: p.avatar_color,
    hat: p.hat,
    gameName: meta.name,
    world: toneOf(meta),
    senderMs: c.sender_ms,
    domain: SHARE_DOMAIN,
  });
}
