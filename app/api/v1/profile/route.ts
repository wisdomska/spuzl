import { z } from "zod";
import { body, handle, ok, rateLimit, requireUser, ApiError } from "@/lib/api/server";
import { nicknameProblem } from "@/lib/validation/nickname";
import { verifyTurnstile } from "@/lib/validation/turnstile";
import { ageBandOf, bandRank, birthProblem, effectiveBand } from "@/lib/age";
import { ageCopy } from "@/lib/copy/age";

const Create = z.object({
  nickname: z.string().trim().optional(),
  /** Birth month and year (no day): required to create a profile, then locked. */
  birthYear: z.number().int().optional(),
  birthMonth: z.number().int().min(1).max(12).optional(),
  /** Older clients sent a chosen band. It is never stored: the band comes from birth month and year. */
  ageBand: z.enum(["13-15", "16-17", "18+"]).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  turnstile: z.string().optional(),
  country: z.string().length(2).optional(),
});

const locked = () => new ApiError(409, "age_locked", ageCopy.locked);
const tooYoung = () => new ApiError(403, "too_young", ageCopy.tooYoung);

/**
 * POST /api/v1/profile: creates the player profile for a signed-in (often anonymous) user, with their birth month
 * and year. The age band is derived on the server (lib/age; the database trigger does the same), never chosen.
 * Under 13: refused with too_young and nothing is written (no profile, no data kept).
 *
 * Posting again for an existing profile updates nickname, colour and country as before, but birth month and year
 * are locked: a different one (or a different band) is refused with 409 age_locked. Players from before birth month
 * and year were asked add theirs here once ({birthYear, birthMonth} alone is enough). It must not put them in an
 * older band than the one they chose when they joined (409 age_locked; an admin can correct it), and under 13 is
 * refused (too_young) without touching their profile, so nobody is locked out.
 */
export const POST = handle(async (req: Request) => {
  const { user, admin } = await requireUser();
  await rateLimit(admin, `profile:${user.id}`, 10, 3600);
  const input = await body(req, Create);
  const hasBirth = input.birthYear !== undefined && input.birthMonth !== undefined;
  if (hasBirth && birthProblem(input.birthYear!, input.birthMonth!)) throw new ApiError(422, "birth_invalid", ageCopy.birthInvalid);
  const derived = hasBirth ? ageBandOf(input.birthYear, input.birthMonth) : null;

  const { data: existing, error: readError } = await admin
    .from("players")
    .select("id, age_band, birth_year, birth_month, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const birth: { birth_year?: number; birth_month?: number } = {};
    if (existing.birth_year != null) {
      if (hasBirth && (input.birthYear !== existing.birth_year || input.birthMonth !== existing.birth_month)) throw locked();
      if (input.ageBand && input.ageBand !== effectiveBand(existing)) throw locked();
    } else if (hasBirth) {
      if (!derived) throw tooYoung();
      // Accepted when, on the day they joined, this birth month and year gives the band they chose or a younger one.
      const atJoin = ageBandOf(input.birthYear, input.birthMonth, new Date(existing.created_at));
      if (bandRank(atJoin ?? "13-15") > bandRank(existing.age_band)) throw locked();
      birth.birth_year = input.birthYear;
      birth.birth_month = input.birthMonth;
    } else if (input.ageBand && input.ageBand !== existing.age_band) throw locked();
    if (input.nickname !== undefined) {
      const problem = nicknameProblem(input.nickname);
      if (problem) throw new ApiError(422, "nickname_rejected", problem);
    }
    const { error } = await admin
      .from("players")
      .update({
        ...birth,
        ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
        ...(input.color ? { avatar_color: input.color } : {}),
        ...(input.country ? { country: input.country } : {}),
        is_guest: !!user.is_anonymous,
      })
      .eq("id", user.id);
    if (error?.code === "23505") throw new ApiError(409, "nickname_taken", "That name is taken.");
    if (error?.message?.includes("age_locked")) throw locked();
    if (error?.message?.includes("too_young")) throw tooYoung();
    if (error) throw error;
    return ok({ ok: true, ageBand: effectiveBand({ ...existing, ...birth }) });
  }

  if (!hasBirth) throw new ApiError(422, "birth_required", ageCopy.birthRequired);
  if (!derived) throw tooYoung();
  if (!input.nickname || !input.color) throw new ApiError(400, "invalid_request", "nickname and color are required.");
  if (!(await verifyTurnstile(input.turnstile, req.headers.get("x-forwarded-for")))) throw new ApiError(403, "bot_check_failed");
  const problem = nicknameProblem(input.nickname);
  if (problem) throw new ApiError(422, "nickname_rejected", problem);
  const { error } = await admin.from("players").insert({
    id: user.id,
    nickname: input.nickname,
    birth_year: input.birthYear,
    birth_month: input.birthMonth,
    // The trigger derives it again from birth month and year; this keeps the row valid on its own.
    age_band: derived,
    avatar_color: input.color,
    country: input.country ?? null,
    is_guest: !!user.is_anonymous,
    // Set SPUZL_TEST_ACCOUNTS=1 on a deployment that shares a production database: its players are
    // test accounts and stay off public boards, medians and leagues.
    is_test: process.env.SPUZL_TEST_ACCOUNTS === "1",
  });
  // Two creates at once: the second finds the first's row (same id), whose age is already set.
  if (error?.code === "23505" && /players_pkey/.test(error.message ?? "")) throw locked();
  if (error?.code === "23505") throw new ApiError(409, "nickname_taken", "That name is taken.");
  if (error?.message?.includes("too_young")) throw tooYoung();
  if (error) throw error;
  await admin.from("streaks").upsert({ player_id: user.id }, { onConflict: "player_id", ignoreDuplicates: true });
  return ok({ ok: true, ageBand: derived });
});

const Patch = z.object({
  nickname: z.string().trim().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  hideActivity: z.boolean().optional(),
  country: z.string().length(2).nullable().optional(),
  city: z.string().max(40).nullable().optional(),
});

/** Fields a player can never change here: age is set once (POST) and corrected only by an admin. */
const AGE_FIELDS = ["birthYear", "birthMonth", "ageBand", "birth_year", "birth_month", "age_band"];

export const PATCH = handle(async (req: Request) => {
  const { user, admin } = await requireUser();
  await rateLimit(admin, `profile-patch:${user.id}`, 30, 3600);
  const raw = (await req
    .clone()
    .json()
    .catch(() => null)) as Record<string, unknown> | null;
  if (raw && typeof raw === "object" && AGE_FIELDS.some((k) => k in raw)) throw locked();
  const input = await body(req, Patch);
  if (input.nickname) {
    const problem = nicknameProblem(input.nickname);
    if (problem) throw new ApiError(422, "nickname_rejected", problem);
  }
  const { error } = await admin
    .from("players")
    .update({
      ...(input.nickname ? { nickname: input.nickname } : {}),
      ...(input.color ? { avatar_color: input.color } : {}),
      ...(input.settings ? { settings: input.settings } : {}),
      ...(input.hideActivity !== undefined ? { hide_activity: input.hideActivity } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
    })
    .eq("id", user.id);
  if (error?.code === "23505") throw new ApiError(409, "nickname_taken", "That name is taken.");
  if (error) throw error;
  return ok({ ok: true });
});
