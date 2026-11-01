import { createHash } from "node:crypto";
import { z } from "zod";
import { body, handle, rateLimit } from "@/lib/api/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GAME_BY_ID } from "@/lib/catalog";

const label = z.string().regex(/^[a-z_]{1,16}$/);
const Metric = z
  .object({
    name: z.enum(["tap_to_board", "hint_cancel", "share"]),
    game: z
      .string()
      .refine((g) => g in GAME_BY_ID)
      .optional(),
    mode: label.optional(),
    kind: label.optional(),
    ms: z.number().int().min(0).max(120_000).optional(),
  })
  .refine(
    (m) => m.name !== "tap_to_board" || (m.ms !== undefined && (m.kind === "tap" || m.kind === "load")),
    "tap_to_board needs ms and kind",
  );

/**
 * POST /api/v1/metrics: one anonymous client measurement for the admin Metrics page (tap-to-board latency,
 * hint-confirm cancels, shares). Guests and signed-out visitors may send; nothing that identifies them is
 * stored (no player id, IP or URL). Rate limited per user, else per hashed client address.
 */
export const POST = handle(async (req: Request) => {
  const m = await body(req, Metric);
  const db = supabaseAdmin();
  const user = await currentUser();
  const who =
    user?.id ??
    createHash("sha256")
      .update(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown")
      .digest("hex")
      .slice(0, 24);
  await rateLimit(db, `metrics:${who}`, 120, 600);
  const { error } = await db.from("client_metrics").insert({
    name: m.name,
    game_id: m.game ?? null,
    mode: m.mode ?? null,
    kind: m.kind ?? null,
    value_ms: m.name === "tap_to_board" ? (m.ms ?? null) : null,
  });
  if (error) throw error;
  return new Response(null, { status: 204 });
});
