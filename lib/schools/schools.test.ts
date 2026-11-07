import { describe, expect, it } from "vitest";
import { SchoolInput, canSelfJoinSchool, nextSchoolChange, rankLeague, schoolLeagueCsv, type SchoolLeagueRow } from "./index";
import { DEFAULTS } from "@/lib/game-settings/schema";

const row = (id: string, average: number, o: Partial<SchoolLeagueRow> = {}) => ({
  id,
  name: `School ${id}`,
  kind: "school" as const,
  city: "Accra",
  active: 5,
  total: average * 5,
  average,
  ...o,
});

describe("school leagues", () => {
  it("is off by default until the admin seeds schools, ranked by clears, 3 players minimum", () => {
    expect(DEFAULTS["features.schoolLeagues"]).toBe(false);
    expect(DEFAULTS["schoolLeagues.metric"]).toBe("clears");
    expect(DEFAULTS["schoolLeagues.minPlayers"]).toBe(3);
  });

  it("never lets under-16s pick a school by search", () => {
    const year = new Date().getUTCFullYear();
    expect(canSelfJoinSchool({ age_band: "18+" })).toBe(true);
    expect(canSelfJoinSchool({ age_band: "16-17" })).toBe(true);
    expect(canSelfJoinSchool({ age_band: "13-15" })).toBe(false);
    // The effective band wins over a stale stored one.
    expect(canSelfJoinSchool({ age_band: "16-17", birth_year: year - 14, birth_month: 1 })).toBe(false);
  });

  it("allows one self-picked change a week", () => {
    const now = Date.parse("2026-11-07T12:00:00Z");
    expect(nextSchoolChange(null, now)).toBeNull();
    expect(nextSchoolChange("2026-11-05T12:00:00Z", now)).toBe(Date.parse("2026-11-12T12:00:00Z"));
    expect(nextSchoolChange("2026-10-30T11:00:00Z", now)).toBeNull();
  });

  it("ranks by average, sharing a rank on a tie", () => {
    expect(rankLeague([row("a", 9), row("b", 7.5), row("c", 7.5), row("d", 2)]).map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("exports school names and aggregates only, safe for spreadsheets", () => {
    const csv = schoolLeagueCsv(
      "2026-11-02",
      "clears",
      rankLeague([row("a", 4, { name: '=HYPERLINK("x")', city: "Cape Coast, Central" })]),
    );
    const [head, line] = csv.trim().split("\r\n");
    expect(head).toBe("week,rank,school,kind,city,active_players,total_clears,average_clears");
    expect(line).toBe(`2026-11-02,1,"'=HYPERLINK(""x"")",school,"Cape Coast, Central",5,20,4`);
    expect(csv).not.toMatch(/nickname|player_id/);
  });

  it("checks admin school input", () => {
    expect(SchoolInput.parse({ name: "  Achimota School ", city: "Accra" })).toMatchObject({ name: "Achimota School", kind: "school" });
    expect(SchoolInput.safeParse({ name: "KN" }).success).toBe(false);
    expect(SchoolInput.safeParse({ name: "KNUST", kind: "campus" }).success).toBe(true);
    expect(SchoolInput.safeParse({ name: "KNUST", kind: "club" }).success).toBe(false);
  });
});
