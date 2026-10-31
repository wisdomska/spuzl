import { handle, ok, requirePlayer } from "@/lib/api/server";
import { makeCode } from "@/lib/social";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://spuzl.vercel.app";

/** GET /api/v1/friends/invite: your personal invite code and link (created on first use). */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  const { data: existing } = await admin.from("invites").select("code").eq("player_id", player.id).maybeSingle();
  let code = existing?.code as string | undefined;
  for (let i = 0; !code && i < 5; i++) {
    const candidate = makeCode(6);
    const { error } = await admin.from("invites").insert({ code: candidate, player_id: player.id });
    if (!error) code = candidate;
    else if (error.code !== "23505") throw error;
    else {
      // either the code collided or another request created ours first
      const { data } = await admin.from("invites").select("code").eq("player_id", player.id).maybeSingle();
      code = data?.code;
    }
  }
  if (!code) throw new Error("invite code");
  const url = `${SITE.replace(/\/$/, "")}/i/${code}`;
  return ok({ code, url, nickname: player.nickname });
});
