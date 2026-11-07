import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { getGameSettings } from "@/lib/game-settings/server";
import { weekStartOf } from "@/lib/leagues";
import { canSelfJoinSchool, nextSchoolChange, rankLeague, type LeagueMetric, type SchoolKind, type SchoolLeagueRow } from "./index";

/**
 * School and campus leagues (R2-P5). Every rule the screens show is enforced here: the admin switch, verified
 * schools only, no search or self-join for under-16s (only a teacher's class code), one self-picked change a week,
 * and a public table of school names and aggregates only.
 */

export async function assertSchoolLeaguesOn() {
  if (!(await getGameSettings())["features.schoolLeagues"]) throw new ApiError(404, "school_leagues_off");
}

type Who = { id: string; age_band: string };

/** The player's band row with birth month and year (the age rules read the effective band). */
async function bandOf(admin: SupabaseClient, id: string) {
  const { data } = await admin.from("players").select("age_band, birth_year, birth_month, school_id, school_set_at").eq("id", id).single();
  return data as {
    age_band: string;
    birth_year: number | null;
    birth_month: number | null;
    school_id: string | null;
    school_set_at: string | null;
  };
}

/** GET /api/v1/schools?q=: verified schools by name, 16 and over only. */
export async function searchSchools(admin: SupabaseClient, me: Who, q: string) {
  await assertSchoolLeaguesOn();
  if (!canSelfJoinSchool(await bandOf(admin, me.id)))
    throw new ApiError(403, "use_class_code", "Ask your teacher for your class code to join your school.");
  const term = q
    .trim()
    .replace(/[%_\\,()]/g, " ")
    .trim();
  if (term.length < 2) return { rows: [] };
  const { data, error } = await admin
    .from("schools")
    .select("id, name, kind, city, country")
    .not("verified_by", "is", null)
    .ilike("name", `%${term}%`)
    .order("name")
    .limit(20);
  if (error) throw error;
  return { rows: data ?? [] };
}

/** POST /api/v1/schools/join { schoolId }: 16 and over pick a verified school; one change a week. */
export async function joinSchool(admin: SupabaseClient, me: Who, schoolId: string) {
  await assertSchoolLeaguesOn();
  const row = await bandOf(admin, me.id);
  if (!canSelfJoinSchool(row)) throw new ApiError(403, "use_class_code", "Ask your teacher for your class code to join your school.");
  if (row.school_id === schoolId) return { schoolId };
  if (nextSchoolChange(row.school_set_at)) throw new ApiError(409, "changed_recently", "You can change your school once a week.");
  const { data: s } = await admin.from("schools").select("id, verified_by").eq("id", schoolId).maybeSingle();
  if (!s?.verified_by) throw new ApiError(404, "school_not_found");
  const { error } = await admin.from("players").update({ school_id: schoolId, school_set_at: new Date().toISOString() }).eq("id", me.id);
  if (error) throw error;
  return { schoolId };
}

/** DELETE /api/v1/schools/join: leaves the school (anyone; an under-16 can rejoin only with a class code). */
export async function leaveSchool(admin: SupabaseClient, me: Who) {
  await assertSchoolLeaguesOn();
  const { error } = await admin.from("players").update({ school_id: null }).eq("id", me.id);
  if (error) throw error;
  return { schoolId: null };
}

/** The weekly table for a Monday (GMT), from svc_school_league with the admin's metric and minimum. */
export async function schoolLeague(admin: SupabaseClient, week = weekStartOf()) {
  const s = await getGameSettings();
  const metric = s["schoolLeagues.metric"] as LeagueMetric;
  const { data, error } = await admin.rpc("svc_school_league", { p_week: week, p_metric: metric, p_min: s["schoolLeagues.minPlayers"] });
  if (error) throw error;
  const rows = rankLeague(
    (
      (data ?? []) as {
        school_id: string;
        name: string;
        kind: SchoolKind;
        city: string | null;
        active: number;
        total: number;
        average: number;
      }[]
    ).map((r) => ({
      id: r.school_id,
      name: r.name,
      kind: r.kind,
      city: r.city,
      active: Number(r.active),
      total: Number(r.total),
      average: Number(r.average),
    })),
  );
  return { week, metric, rows };
}

/** GET /api/v1/schools/league: the table plus the player's own school (name only) and where it stands. */
export async function myLeague(admin: SupabaseClient, me: Who) {
  await assertSchoolLeaguesOn();
  const row = await bandOf(admin, me.id);
  const table = await schoolLeague(admin);
  let mine: { id: string; name: string; kind: SchoolKind; rank: number | null; changeAt: number | null } | null = null;
  if (row.school_id) {
    const { data: s } = await admin.from("schools").select("id, name, kind, verified_by").eq("id", row.school_id).maybeSingle();
    if (s?.verified_by)
      mine = {
        id: s.id,
        name: s.name,
        kind: s.kind ?? "school",
        rank: table.rows.find((r: SchoolLeagueRow) => r.id === s.id)?.rank ?? null,
        changeAt: nextSchoolChange(row.school_set_at),
      };
  }
  return { ...table, mine, canSearch: canSelfJoinSchool(row) };
}
