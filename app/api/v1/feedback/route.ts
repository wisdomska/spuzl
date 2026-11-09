import { createHash } from "node:crypto";
import { body, handle, ok, rateLimit } from "@/lib/api/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { effectiveBand } from "@/lib/age";
import { FEEDBACK_RATE, FeedbackInput, sanitiseFrom, trimUserAgent } from "@/lib/feedback";

/**
 * POST /api/v1/feedback {message, email?, kind?, from?, website?}: one feedback message from /contact (R4-02).
 * Signed in or signed out. Stored with the service role only (public.feedback is server-only): the player's id
 * when there is a profile (else null), their age band (never the birth month or year), the page path it came
 * from (sanitised), the user agent cut to 200 characters, and the email only if they chose to leave one for a
 * reply. `website` is a honeypot: when it's filled the request is thanked and dropped. Rate limited to 5 an hour
 * per player, else per hashed client address.
 */
export const POST = handle(async (req: Request) => {
  const input = await body(req, FeedbackInput);
  const db = supabaseAdmin();
  const user = await currentUser();
  const who =
    user?.id ??
    `ip:${createHash("sha256")
      .update(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown")
      .digest("hex")
      .slice(0, 24)}`;
  await rateLimit(db, `feedback:${who}`, FEEDBACK_RATE.max, FEEDBACK_RATE.windowSeconds);
  // Bots fill every field; people never see this one. Same answer as a real send, nothing stored.
  if (input.website?.trim()) return ok({ ok: true }, { status: 201 });

  let player: { id: string; age_band: string | null; birth_year?: number | null; birth_month?: number | null } | null = null;
  if (user) {
    let r = await db.from("players").select("id, age_band, birth_year, birth_month").eq("id", user.id).maybeSingle();
    // Before migration 20261119000001 (no birth columns): the stored band still works.
    if (r.error?.code === "42703") r = await db.from("players").select("id, age_band").eq("id", user.id).maybeSingle();
    if (r.error) throw r.error;
    player = r.data;
  }
  const { error } = await db.from("feedback").insert({
    player_id: player?.id ?? null,
    age_band: player ? effectiveBand(player) : null,
    kind: input.kind ?? "other",
    message: input.message,
    email: input.email || null,
    from_path: sanitiseFrom(input.from),
    user_agent: trimUserAgent(req.headers.get("user-agent")),
  });
  if (error) throw error;
  return ok({ ok: true }, { status: 201 });
});
