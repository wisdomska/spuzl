import { createHash } from "node:crypto";
import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/supabase/server";
import { codeParam } from "@/lib/multiplayer/server/params";
import { setTvOpen, tvView } from "@/lib/multiplayer/server/tv";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/rooms/:code/tv: the room as the big-screen view shows it (nicknames, progress, places and points;
 * no chat, puzzle, city, level or rating). No player profile needed: a TV or projector joins by code.
 * 403 tv_closed while the host keeps the room closed to watchers (and always for a host under 16); 404 for an
 * unknown or 18+ room and while "features.partyTv" is off. Rate limited per user, else per hashed address.
 */
export const GET = handle(async (req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/tv">) => {
  const code = codeParam((await ctx.params).code);
  const db = supabaseAdmin();
  const user = await currentUser();
  const who =
    user?.id ??
    createHash("sha256")
      .update(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown")
      .digest("hex")
      .slice(0, 24);
  await rateLimit(db, `room-tv:${who}`, 120, 60);
  return ok(await tvView(db, code), { headers: { "cache-control": "no-store" } });
});

const Toggle = z.object({ open: z.boolean() }).strict();

/** POST /api/v1/rooms/:code/tv { open }: the host opens or closes the room to the big-screen view. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/tv">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `room-tv-set:${player.id}`, 30, 60);
  const { open } = await body(req, Toggle);
  return ok(await setTvOpen(admin, player.id, code, open));
});
