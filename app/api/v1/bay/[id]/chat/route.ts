import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { listChat, postChat } from "@/lib/multiplayer/server/chat";

export const dynamic = "force-dynamic";

/** GET /api/v1/bay/:id/chat?after=<id>: a board game's chat since a message, and whether typing is allowed. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `chat-read:${player.id}`, 120, 60);
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0) || 0;
  return ok(await listChat(admin, { kind: "bay", id }, player.id, after));
});

const Post = z.union([z.object({ quick: z.number().int().min(0).max(30) }), z.object({ text: z.string().min(1).max(200) })]);

/** POST /api/v1/bay/:id/chat: { quick: n } for a preset phrase, or { text } in a 16+ room. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  return ok(await postChat(admin, { kind: "bay", id }, player.id, await body(req, Post)));
});
