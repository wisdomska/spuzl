import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, ROLES, isRole } from "@/lib/admin/roles";
import { aalOf } from "@/lib/admin/session";
import { addDays, age, clock, compact, dayMonth, isoWeek, mondayOf, shortDay, weekRange } from "@/lib/admin/dates";
import { CONTENT_GAMES, SCHEDULABLE, TEMPLATES, validatePayload } from "@/lib/admin/content-schemas";
import { solvedStates } from "@/lib/admin/solved-state";
import { LOGIC } from "@/games/logic-registry";
import { createRng } from "@/lib/rng";
import { CONTENT as HUNCH } from "@/games/hunch/content";
import { CONTENT as QUADS } from "@/games/quads/content";
import { CONTENT as RUNGS } from "@/games/rungs/content";
import { CONTENT as COIL } from "@/games/coil/content";
import { CONTENT as MINICROSS } from "@/games/minicross/content";
import { CONTENT as SEVEN } from "@/games/seven/content";
import { CONTENT as REMIX } from "@/games/remix/content";
import { CONTENT as QUICKFIRE } from "@/games/quickfire/content";

describe("admin roles", () => {
  it("gives the owner everything and keeps each other role to its job", () => {
    for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) expect(can("owner", p)).toBe(true);
    expect(can("analyst", "liveops.read")).toBe(true);
    expect(can("analyst", "calendar.write")).toBe(false);
    expect(can("analyst", "moderation.read")).toBe(false);
    expect(can("moderator", "moderation.write")).toBe(true);
    expect(can("moderator", "content.read")).toBe(false);
    expect(can("content_editor", "daily.swap")).toBe(true);
    expect(can("content_editor", "prices.write")).toBe(false);
    expect(can("content_editor", "content.owner_review")).toBe(false);
    expect(can("content_editor", "team.manage")).toBe(false);
    expect(can(null, "calendar.read")).toBe(false);
    expect(ROLES.every(isRole)).toBe(true);
    expect(isRole("superuser")).toBe(false);
  });
});

describe("admin session", () => {
  const jwt = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;
  it("reads the assurance level from a token", () => {
    expect(aalOf(jwt({ aal: "aal2" }))).toBe("aal2");
    expect(aalOf(jwt({ aal: "aal1" }))).toBe("aal1");
    expect(aalOf(jwt({}))).toBeNull();
    expect(aalOf("garbage")).toBeNull();
  });
});

describe("admin dates", () => {
  it("formats GMT weeks and days like the design", () => {
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
    expect(isoWeek("2026-11-03")).toBe(45);
    expect(weekRange("2026-11-02")).toBe("2 to 8 Nov");
    expect(weekRange("2026-10-26")).toBe("26 Oct to 1 Nov");
    expect(shortDay("2026-11-03")).toBe("Tue 3");
    expect(dayMonth("2026-11-07")).toBe("Sat 7 Nov");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(clock(104_000)).toBe("1:44");
    expect(clock(null)).toBe("");
    expect(compact(212_000)).toBe("212k");
    expect(compact(61_200)).toBe("61.2k");
    expect(compact(18_402)).toBe("18,402");
    const now = Date.parse("2026-10-31T12:00:00Z");
    expect(age("2026-10-31T11:48:00Z", now)).toBe("12m");
    expect(age("2026-10-31T09:00:00Z", now)).toBe("3h");
    expect(age("2026-10-28T12:00:00Z", now)).toBe("3d");
  });
});

describe("content payload schemas", () => {
  it("accept every real content.ts entry", () => {
    const real: [string, unknown[]][] = [
      ["hunch", HUNCH],
      ["quads", QUADS],
      ["rungs", RUNGS],
      ["coil", COIL],
      ["minicross", MINICROSS],
      ["seven", SEVEN],
      ["remix", REMIX],
      ["quickfire", QUICKFIRE],
    ];
    for (const [game, entries] of real)
      for (const e of entries) {
        const r = validatePayload(game, e);
        expect(r.success, `${game} ${JSON.stringify(e).slice(0, 60)} ${JSON.stringify(!r.success && r.issues)}`).toBe(true);
      }
  });

  it("reject malformed payloads with a path", () => {
    const bad = validatePayload("coil", { theme: "x", words: ["ABCD", "EFGH", "IJKL"] });
    expect(bad.success).toBe(false);
    expect(!bad.success && bad.issues[0].path).toEqual(["words"]);
    expect(
      validatePayload("rungs", { words: ["COLD", "CORD", "WARM", "WORD", "WORE", "CORE", "CARE"], clues: Array(7).fill("x") }).success,
    ).toBe(false);
    expect(validatePayload("hunch", { ...HUNCH[0], category: "No – dashes" }).success).toBe(false);
    expect(validatePayload("crownfall", {}).success).toBe(false);
    expect(validatePayload("quickfire", { items: QUICKFIRE.slice(0, 5) }).success).toBe(true);
    expect(validatePayload("quickfire", { items: QUICKFIRE.slice(0, 4) }).success).toBe(false);
  });

  it("have a template for every game and only schedule whole Dailies", () => {
    for (const g of CONTENT_GAMES) expect(TEMPLATES[g]).toBeDefined();
    expect(SCHEDULABLE.pinned).toBeUndefined();
    expect(SCHEDULABLE.hunch?.guessRoute).toBe(false);
  });
});

describe("solved states for the solve-check", () => {
  it("make verify() accept the stored solution for launch games", async () => {
    for (const game of [
      "crownfall",
      "dusk",
      "sixer",
      "weave",
      "flowline",
      "quilt",
      "deadon",
      "coil",
      "rungs",
      "quads",
      "minicross",
      "hunch",
    ]) {
      const logic = (await LOGIC[game]()).default;
      const g = logic.generate(createRng(`admin:${game}`), "easy");
      const ok = solvedStates(game, g.puzzle, g.solution).some(({ state }) => {
        try {
          return logic.verify(g.puzzle, g.solution, state).ok;
        } catch {
          return false;
        }
      });
      expect(ok, game).toBe(true);
    }
  }, 60_000);
});
