import { z } from "zod";
import { ApiError, body, handle, ok, requireUser } from "@/lib/api/server";
import { serverBroadcast } from "@/lib/realtime/server";
import { checkBatch, encodePoints, INK, inkTopic, type InkWire } from "@/lib/party-adult/ink";
import { openInkPass } from "@/lib/party-adult/ink-pass";

const Ink = z.object({
  /** the drawer's pass from the round view */
  pass: z.string().max(400),
  s: z.number().int(),
  c: z.number().int(),
  w: z.number().int(),
  i: z.number().int(),
  p: z.array(z.number().int()).max(INK.maxPerBatch * 2),
  e: z.literal(1).optional(),
});

/** Batches a pass may relay per window, per server instance: about four times the drawer's own pace. */
const BURST = { max: Math.ceil((4 * 2000) / INK.batchMs), windowMs: 2000 };
const recent = new Map<string, { n: number; since: number }>();
function allow(key: string, now: number): boolean {
  const e = recent.get(key);
  if (!e || now - e.since > BURST.windowMs) {
    if (recent.size > 5000) recent.clear();
    recent.set(key, { n: 1, since: now });
    return true;
  }
  e.n++;
  return e.n <= BURST.max;
}

/**
 * POST /api/v1/ink: the Draw It live ink relay (R4-24). The drawer posts each live batch with the pass its round
 * view gave it (only the drawer of a drawing round gets one, lib/party-adult/ink-pass.ts). The pass must be this
 * server's, unexpired and the caller's own; the batch must pass the same checks viewers apply. The relay then
 * broadcasts it on the room's ink channel, which players can only read, stamped with the drawer and round from
 * the pass, so a viewer never shows a line someone else forged. Nothing is stored; no database read per batch.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  const { pass: raw, ...batch } = await body(req, Ink);
  const now = Date.now();
  const pass = openInkPass(raw, now);
  if (!pass || pass.p !== user.id) throw new ApiError(403, "not_the_drawer");
  if (!allow(`${pass.m}:${pass.r}:${pass.p}`, now)) throw new ApiError(429, "rate_limited");
  const b = checkBatch(batch);
  if (!b) throw new ApiError(400, "bad_ink");
  const wire: InkWire = {
    by: pass.p,
    r: pass.r,
    s: b.s,
    c: b.c,
    w: b.w,
    i: b.i,
    p: encodePoints(b.p),
    ...(b.end ? { e: 1 as const } : {}),
  };
  await serverBroadcast(inkTopic(pass.m), "ink", wire);
  return ok({ ok: true });
});
