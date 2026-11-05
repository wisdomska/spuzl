import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer, ApiError } from "@/lib/api/server";
import { vapidKeys } from "@/lib/push/server";

export const dynamic = "force-dynamic";

/** GET /api/v1/push: the public key a device subscribes with, or null when push is not set up. */
export const GET = handle(async () => {
  const { admin } = await requirePlayer();
  return ok({ publicKey: (await vapidKeys(admin))?.publicKey ?? null });
});

const Sub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** POST /api/v1/push: this device wants alerts (your turn, nudges, invites) while SPUZL is closed. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `push-sub:${player.id}`, 20, 3600);
  const s = await body(req, Sub);
  if (!/^https:\/\//.test(s.endpoint)) throw new ApiError(400, "bad_endpoint");
  const { error } = await admin
    .from("push_subscriptions")
    .upsert({ endpoint: s.endpoint, player_id: player.id, p256dh: s.keys.p256dh, auth: s.keys.auth }, { onConflict: "endpoint" });
  if (error) throw error;
  return ok({ on: true });
});

const Off = z.object({ endpoint: z.string().url().max(1000) });

/** DELETE /api/v1/push: stop alerts on this device. */
export const DELETE = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  const { endpoint } = await body(req, Off);
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("player_id", player.id);
  return ok({ on: false });
});
