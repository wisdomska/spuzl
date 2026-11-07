import { createHash } from "node:crypto";
import { z } from "zod";
import { body, handle, rateLimit } from "@/lib/api/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { playableGame } from "@/lib/catalog";
import { isOnboardingStep } from "@/lib/analytics/onboarding";
import { isPromptTrigger } from "@/lib/prompts/ids";

const label = z.string().regex(/^[a-z_]{1,16}$/);
const Metric = z
  .object({
    // hint_cancel: older clients only (now hint_request minus hint_use).
    name: z.enum([
      "tap_to_board",
      "hint_cancel",
      "hint_request",
      "hint_use",
      "share",
      "onboarding_step",
      "party_first_move",
      "prompt_shown",
      "prompt_accepted",
      "prompt_dismissed",
      // Daily Five (R2-05)
      "daily5_start",
      "daily5_complete",
      "daily5_share",
    ]),
    game: z
      .string()
      .refine((g) => !!playableGame(g))
      .optional(),
    mode: label.optional(),
    kind: label.optional(),
    ms: z.number().int().min(0).max(120_000).optional(),
    /** tap_to_board only (R2-ADMIN): false = the first board of the page session (cold), true = a later one */
    warm: z.boolean().optional(),
  })
  .refine(
    (m) => m.name !== "tap_to_board" || (m.ms !== undefined && (m.kind === "tap" || m.kind === "load")),
    "tap_to_board needs ms and kind",
  )
  .refine((m) => m.name !== "party_first_move" || m.ms !== undefined, "party_first_move needs ms")
  .refine((m) => m.name !== "onboarding_step" || isOnboardingStep(m.kind), "onboarding_step needs a known step as kind")
  .refine((m) => !m.name.startsWith("hint_") || m.name === "hint_cancel" || m.kind === "confirm" || m.kind === "direct", {
    message: "hint_request and hint_use need kind confirm or direct",
  })
  .refine((m) => !m.name.startsWith("prompt_") || isPromptTrigger(m.mode, m.kind), {
    message: "prompt events need a known prompt as mode and one of its triggers as kind",
  });

/** Metrics that carry a duration (value_ms): tap-to-board latency and Party start-to-first-move. */
const TIMED = new Set(["tap_to_board", "party_first_move"]);

/**
 * POST /api/v1/metrics: one anonymous client measurement for the admin Metrics page (tap-to-board latency,
 * hint requests and uses, shares, onboarding steps, Party start-to-first-move, prompts shown, accepted and dismissed by trigger). Guests and signed-out visitors may send; nothing that identifies them is
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
  const row = {
    name: m.name,
    game_id: m.game ?? null,
    mode: m.mode ?? null,
    kind: m.kind ?? null,
    value_ms: TIMED.has(m.name) ? (m.ms ?? null) : null,
  };
  // R2-ADMIN: tap_to_board says whether it was the page's first board (cold) or a later one (warm).
  const warm = m.name === "tap_to_board" && typeof m.warm === "boolean" ? { warm: m.warm } : {};
  let { error } = await db.from("client_metrics").insert({ ...row, ...warm });
  // Before 20261202000301 adds the column (42703 undefined column), keep the measurement without the split.
  if (error?.code === "42703" && "warm" in warm) ({ error } = await db.from("client_metrics").insert(row));
  if (error) throw error;
  return new Response(null, { status: 204 });
});
