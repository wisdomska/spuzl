import { handle, ok, rateLimit, requirePlayer, ApiError } from "@/lib/api/server";
import { channelToken } from "@/lib/realtime/server";

/** GET /api/v1/realtime/token?topic=: channel token for the Ably and PartyKit adapters, after a membership check. */
export const GET = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `rt-token:${player.id}`, 60, 60);
  const topic = new URL(req.url).searchParams.get("topic") ?? "";
  const [kind, id] = topic.split(":");
  if (!/^[0-9a-f-]{36}$/i.test(id ?? "")) throw new ApiError(400, "bad_topic");
  let allowed = false;
  if (kind === "match") {
    const { data } = await admin.from("match_players").select("player_id").eq("match_id", id).eq("player_id", player.id).is("left_at", null).maybeSingle();
    allowed = !!data;
  } else if (kind === "bay") {
    const { data } = await admin.from("board_matches").select("id").eq("id", id).contains("players", [player.id]).maybeSingle();
    allowed = !!data;
  } else if (kind === "user") allowed = id === player.id;
  if (!allowed) throw new ApiError(403, "not_in_match");
  return ok(await channelToken(topic, player.id));
});
