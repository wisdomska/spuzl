import { z } from "zod";
import { body, handle, ok, rateLimit, requireUser, ApiError } from "@/lib/api/server";
import { nicknameProblem } from "@/lib/validation/nickname";
import { verifyTurnstile } from "@/lib/validation/turnstile";

const Create = z.object({
  nickname: z.string().trim(),
  ageBand: z.enum(["13-15", "16-17", "18+"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  turnstile: z.string().optional(),
  country: z.string().length(2).optional(),
});

/** Creates the player profile for a signed-in (often anonymous) user. Under-13 never reaches here. */
export const POST = handle(async (req: Request) => {
  const { user, admin } = await requireUser();
  await rateLimit(admin, `profile:${user.id}`, 10, 3600);
  const input = await body(req, Create);
  if (!(await verifyTurnstile(input.turnstile, req.headers.get("x-forwarded-for")))) throw new ApiError(403, "bot_check_failed");
  const problem = nicknameProblem(input.nickname);
  if (problem) throw new ApiError(422, "nickname_rejected", problem);
  const { error } = await admin.from("players").upsert(
    {
      id: user.id,
      nickname: input.nickname,
      age_band: input.ageBand,
      avatar_color: input.color,
      country: input.country ?? null,
      is_guest: !!user.is_anonymous,
      // Set SPUZL_TEST_ACCOUNTS=1 on a deployment that shares a production database: its players are
      // test accounts and stay off public boards, medians and leagues.
      is_test: process.env.SPUZL_TEST_ACCOUNTS === "1",
    },
    { onConflict: "id" },
  );
  if (error?.code === "23505") throw new ApiError(409, "nickname_taken", "That name is taken.");
  if (error) throw error;
  await admin.from("streaks").upsert({ player_id: user.id }, { onConflict: "player_id", ignoreDuplicates: true });
  return ok({ ok: true });
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

export const PATCH = handle(async (req: Request) => {
  const { user, admin } = await requireUser();
  await rateLimit(admin, `profile-patch:${user.id}`, 30, 3600);
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
