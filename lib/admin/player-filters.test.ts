import { describe, expect, it } from "vitest";
import {
  ACTION_PERMISSION,
  ActionBody,
  BulkBody,
  PLAYER_ACTIONS,
  accountTypeOf,
  confirmMatches,
  maskEmail,
  parsePlayerFilters,
  playerStatuses,
  playersCsv,
  searchKind,
  type PlayerRow,
} from "./player-filters";
import { can, ROLES } from "./roles";

const sp = (s: string) => new URLSearchParams(s);
const ID = "3f2a1b4c-0000-4000-8000-000000000001";

describe("searchKind", () => {
  it("tells ids, emails and nicknames apart", () => {
    expect(searchKind(ID)).toBe("id");
    expect(searchKind(` ${ID.toUpperCase()} `)).toBe("id");
    expect(searchKind("jane@example.com")).toBe("email");
    expect(searchKind("Puzzler12")).toBe("nickname");
  });
});

describe("parsePlayerFilters", () => {
  it("maps URL filters to the SQL filter object, leaving empty ones out", () => {
    const r = parsePlayerFilters(
      sp("q=ace&account=google&age=13-15&status=banned&reports=open&test=include&joinedFrom=2031-01-01&activeTo=2031-02-01&status2=x"),
    );
    expect(r).toEqual({
      success: true,
      data: {
        q: "ace",
        q_kind: "nickname",
        account: "google",
        age: "13-15",
        status: "banned",
        reports: "open",
        test: "include",
        joined_from: "2031-01-01",
        active_to: "2031-02-01",
      },
    });
    expect(parsePlayerFilters(sp("account=&q="))).toEqual({ success: true, data: {} });
  });

  it("rejects values off the lists, bad dates and reversed ranges", () => {
    for (const q of [
      "account=facebook",
      "age=12",
      "status=deleted",
      "reports=lots",
      "test=maybe",
      "joinedFrom=01/02/2031",
      "joinedFrom=2031-02-02&joinedTo=2031-02-01",
      "activeFrom=2031-02-02&activeTo=2031-01-01",
      `q=${"x".repeat(201)}`,
    ])
      expect(parsePlayerFilters(sp(q)).success, q).toBe(false);
  });
});

describe("account type and email masking (same rules as the SQL)", () => {
  it("classifies accounts", () => {
    expect(accountTypeOf([], true, null)).toBe("guest");
    expect(accountTypeOf(["email"], false, "a@b.co")).toBe("email");
    expect(accountTypeOf([], false, "a@b.co")).toBe("email");
    expect(accountTypeOf(["email", "google"], false, "a@b.co")).toBe("google");
    expect(accountTypeOf(["google"], false, null)).toBe("google");
  });

  it("masks emails down to a letter and the top-level domain", () => {
    expect(maskEmail("jane.doe@example.com")).toBe("j•••@•••.com");
    expect(maskEmail("x@localhost")).toBe("x•••@•••");
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail("not-an-email")).toBeNull();
  });
});

describe("statuses", () => {
  const base = { banned_at: null, banned_until: null, ranking_revoked: false, flagged: 0, is_test: false };
  it("lists every status that applies", () => {
    expect(playerStatuses(base)).toEqual(["active"]);
    expect(playerStatuses({ ...base, banned_at: "x", banned_until: "y", ranking_revoked: true, flagged: 2 })).toEqual([
      "temp_banned",
      "ranking_revoked",
      "flagged",
    ]);
    expect(playerStatuses({ ...base, banned_at: "x", is_test: true })).toEqual(["banned", "test"]);
  });
});

describe("action permissions", () => {
  it("gives analysts nothing, moderators no Sparks or deletion, the owner everything", () => {
    for (const a of PLAYER_ACTIONS) {
      expect(can("analyst", ACTION_PERMISSION[a]), a).toBe(false);
      expect(can("content_editor", ACTION_PERMISSION[a]), a).toBe(false);
      expect(can("owner", ACTION_PERMISSION[a]), a).toBe(true);
    }
    expect(can("moderator", ACTION_PERMISSION.ban)).toBe(true);
    expect(can("moderator", ACTION_PERMISSION.signout)).toBe(true);
    expect(can("moderator", ACTION_PERMISSION.sparks)).toBe(false);
    expect(can("moderator", ACTION_PERMISSION.delete)).toBe(false);
  });

  it("lets only the owner see emails or export, and every action role also reads the list", () => {
    expect(ROLES.filter((r) => can(r, "players.pii"))).toEqual(["owner"]);
    expect(ROLES.filter((r) => can(r, "players.export"))).toEqual(["owner"]);
    for (const r of ROLES) if (can(r, "players.moderate")) expect(can(r, "players.read")).toBe(true);
    expect(can("analyst", "players.read")).toBe(true);
  });
});

describe("action bodies", () => {
  it("requires a reason on every action", () => {
    for (const action of PLAYER_ACTIONS) expect(ActionBody.safeParse({ action, amount: 5, confirm: "x" }).success, action).toBe(false);
    expect(ActionBody.safeParse({ action: "freeze", reason: "  " }).success).toBe(false);
    expect(ActionBody.safeParse({ action: "freeze", reason: "outage" }).success).toBe(true);
  });

  it("bounds Sparks and ban length", () => {
    const ok = (b: object) => ActionBody.safeParse({ reason: "test run", ...b }).success;
    expect(ok({ action: "sparks", amount: 10_000 })).toBe(true);
    expect(ok({ action: "sparks", amount: -10_000 })).toBe(true);
    expect(ok({ action: "sparks", amount: 10_001 })).toBe(false);
    expect(ok({ action: "sparks", amount: 0 })).toBe(false);
    expect(ok({ action: "sparks", amount: 1.5 })).toBe(false);
    expect(ok({ action: "ban", days: 7 })).toBe(true);
    expect(ok({ action: "ban", days: null })).toBe(true);
    expect(ok({ action: "ban", days: 366 })).toBe(false);
    expect(ok({ action: "delete" })).toBe(false);
  });

  it("matches the typed confirmation like the player's own deletion", () => {
    expect(confirmMatches(" ace_99 ", "Ace_99")).toBe(true);
    expect(confirmMatches("ace_9", "Ace_99")).toBe(false);
    expect(confirmMatches("", "Ace_99")).toBe(false);
  });

  it("allows only safe bulk actions on up to 100 distinct ids", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => ID.slice(0, -3) + String(i).padStart(3, "0"));
    expect(BulkBody.safeParse({ action: "ban", ids: ids(2), reason: "spam ring" }).success).toBe(true);
    expect(BulkBody.safeParse({ action: "revoke_ranking", ids: ids(100), reason: "spam ring" }).success).toBe(true);
    expect(BulkBody.safeParse({ action: "delete", ids: ids(2), reason: "spam ring" }).success).toBe(false);
    expect(BulkBody.safeParse({ action: "ban", ids: ids(101), reason: "spam ring" }).success).toBe(false);
    expect(BulkBody.safeParse({ action: "ban", ids: [ID, ID], reason: "spam ring" }).success).toBe(false);
    expect(BulkBody.safeParse({ action: "ban", ids: [], reason: "spam ring" }).success).toBe(false);
  });
});

describe("playersCsv", () => {
  const row: PlayerRow = {
    id: ID,
    nickname: "=cmd",
    account_type: "email",
    providers: ["email"],
    email: "jane@example.com",
    age_band: "18+",
    level: 3,
    xp: 400,
    sparks: 20,
    streak: 2,
    best_streak: 5,
    freezes: 0,
    last_active: null,
    created_at: "2031-01-01T00:00:00Z",
    banned_at: null,
    banned_until: null,
    ranking_revoked: true,
    is_test: false,
    flagged: 0,
    reports_open: 1,
    reports_total: 1,
  };

  it("leaves the email column out entirely without permission", () => {
    const csv = playersCsv([row], false);
    expect(csv.split("\r\n")[0]).not.toContain("email");
    expect(csv).not.toContain("jane@example.com");
  });

  it("includes it with permission and neutralises formula cells", () => {
    const [head, line] = playersCsv([row], true).split("\r\n");
    expect(head.split(",")).toContain("email");
    expect(line).toContain("jane@example.com");
    expect(line).toContain("'=cmd");
    expect(line).toContain("ranking_revoked");
  });
});
