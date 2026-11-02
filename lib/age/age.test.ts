import { describe, expect, it } from "vitest";
import { adultPartyRefusal } from "@/lib/party-adult/gate";
import { canRequestByUsername, isUnder16 } from "@/lib/social";
import { ageBandOf, ageOn, bandRank, birthProblem, birthYears, effectiveBand } from ".";

/** GMT midnight on a day. */
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("ageOn", () => {
  it("counts the birthday from the 1st of the month after the birth month", () => {
    // Born March 2010.
    expect(ageOn(2010, 3, d("2026-02-28"))).toBe(15);
    expect(ageOn(2010, 3, d("2026-03-01"))).toBe(15);
    expect(ageOn(2010, 3, d("2026-03-31"))).toBe(15);
    expect(ageOn(2010, 3, d("2026-04-01"))).toBe(16);
  });
  it("handles December and January births across the year end", () => {
    expect(ageOn(2010, 12, d("2026-12-31"))).toBe(15);
    expect(ageOn(2010, 12, d("2027-01-01"))).toBe(16);
    expect(ageOn(2010, 1, d("2026-01-31"))).toBe(15);
    expect(ageOn(2010, 1, d("2026-02-01"))).toBe(16);
  });
  it("uses GMT, not the machine's zone", () => {
    expect(ageOn(2010, 3, new Date("2026-03-31T23:59:59Z"))).toBe(15);
    expect(ageOn(2010, 3, new Date("2026-04-01T00:00:00Z"))).toBe(16);
  });
});

describe("ageBandOf", () => {
  it("is null under 13 and for missing input", () => {
    expect(ageBandOf(2013, 6, d("2026-06-30"))).toBeNull(); // 12 until July
    expect(ageBandOf(null, 6)).toBeNull();
    expect(ageBandOf(2000, null)).toBeNull();
  });
  it("crosses 13 by month", () => {
    expect(ageBandOf(2013, 6, d("2026-06-15"))).toBeNull();
    expect(ageBandOf(2013, 6, d("2026-07-01"))).toBe("13-15");
  });
  it("crosses 16 by month", () => {
    expect(ageBandOf(2010, 9, d("2026-09-30"))).toBe("13-15");
    expect(ageBandOf(2010, 9, d("2026-10-01"))).toBe("16-17");
  });
  it("crosses 18 by month", () => {
    expect(ageBandOf(2008, 11, d("2026-11-02"))).toBe("16-17");
    expect(ageBandOf(2008, 11, d("2026-12-01"))).toBe("18+");
    expect(ageBandOf(1970, 1, d("2026-11-02"))).toBe("18+");
  });
  it("moves a player up through every band as they age", () => {
    const bands = ["2023-03-01", "2023-04-01", "2026-04-01", "2028-04-01"].map((t) => ageBandOf(2010, 3, d(t)));
    expect(bands).toEqual([null, "13-15", "16-17", "18+"]);
  });
});

describe("birthProblem and birthYears", () => {
  const today = d("2026-11-02");
  it("accepts this month, refuses the future and nonsense", () => {
    expect(birthProblem(2026, 11, today)).toBeNull();
    expect(birthProblem(2026, 12, today)).toBe("future");
    expect(birthProblem(2027, 1, today)).toBe("future");
    expect(birthProblem(2000, 0, today)).toBe("invalid");
    expect(birthProblem(2000, 13, today)).toBe("invalid");
    expect(birthProblem(2000.5, 3, today)).toBe("invalid");
    expect(birthProblem(1925, 1, today)).toBe("invalid");
    expect(birthProblem(1926, 1, today)).toBeNull();
  });
  it("offers this year back 100 years, newest first", () => {
    const ys = birthYears(today);
    expect(ys[0]).toBe(2026);
    expect(ys.at(-1)).toBe(1926);
    expect(ys).toHaveLength(101);
  });
});

describe("effectiveBand", () => {
  it("derives from birth month and year when kept, ignoring a stale stored band", () => {
    expect(effectiveBand({ age_band: "18+", birth_year: 2010, birth_month: 3 }, d("2026-03-15"))).toBe("13-15");
    expect(effectiveBand({ age_band: "13-15", birth_year: 2010, birth_month: 3 }, d("2026-04-01"))).toBe("16-17");
  });
  it("keeps the stored band for players who have not added theirs", () => {
    expect(effectiveBand({ age_band: "16-17", birth_year: null, birth_month: null })).toBe("16-17");
  });
  it("ranks bands youngest first", () => {
    expect(bandRank("13-15")).toBeLessThan(bandRank("16-17"));
    expect(bandRank("16-17")).toBeLessThan(bandRank("18+"));
    expect(bandRank("??")).toBe(-1);
  });
});

describe("gates follow the derived band", () => {
  // Born November 2008: 17 through November 2026, 18 from 1 December 2026.
  const row = { age_band: "16-17", birth_year: 2008, birth_month: 11 };
  it("18+ party opens the month after the 18th birthday", () => {
    const before = effectiveBand(row, d("2026-11-30"));
    const after = effectiveBand(row, d("2026-12-01"));
    expect(adultPartyRefusal({ ageBand: before, guest: false }, true)).toBe("adults_only");
    expect(adultPartyRefusal({ ageBand: after, guest: false }, true)).toBeNull();
  });
  it("under-16 rules lift the month after the 16th birthday", () => {
    const young = { age_band: "13-15", birth_year: 2010, birth_month: 9 };
    const before = effectiveBand(young, d("2026-09-30"));
    const after = effectiveBand(young, d("2026-10-01"));
    expect(isUnder16(before)).toBe(true);
    expect(canRequestByUsername(before, "18+")).toBe(false);
    expect(isUnder16(after)).toBe(false);
    expect(canRequestByUsername(after, "18+")).toBe(true);
  });
  it("a stored 18+ band does not open the 18+ party for a 15-year-old", () => {
    const liar = { age_band: "18+", birth_year: 2011, birth_month: 5 };
    expect(adultPartyRefusal({ ageBand: effectiveBand(liar, d("2026-11-02")), guest: false }, true)).toBe("adults_only");
  });
});
