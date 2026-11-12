// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

/**
 * Admin overhaul, Players area: a player's page leads with who they are (guest or saved account and what that
 * means, age group and what it allows, how active), then what needs action; raw ids stay under Technical details.
 */
let data: unknown = null;
vi.mock("@/lib/client/admin", () => ({
  useAdminQuery: () => ({ isPending: false, error: null, data }),
  useAdminAction: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), reset: vi.fn(), isPending: false, error: null, data: null }),
  errorText: (e: unknown) => String(e),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children as never}</a>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => "/admin/players",
}));

import { PlayerDetail } from "@/components/admin/PlayerDetail";
import { PlayersPage } from "@/components/admin/PlayersPage";

const ID = "6f1c2a3b-0000-4000-8000-000000000001";
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

function detail(over: { account?: string; band?: string; openReport?: boolean; flagged?: number; banned?: boolean } = {}) {
  return {
    profile: {
      id: ID,
      nickname: "Kofi",
      age_band: over.band ?? "13-15",
      birth_year: null,
      birth_month: null,
      level: 4,
      xp: 1200,
      sparks: 340,
      created_at: hoursAgo(24 * 20),
      last_seen_at: hoursAgo(2),
      banned_at: over.banned ? hoursAgo(1) : null,
      banned_until: over.banned ? new Date(Date.now() + 3 * 86_400_000).toISOString() : null,
      ban_reason: over.banned ? "rude nickname" : null,
      ranking_revoked: false,
      is_test: false,
    },
    account: {
      type: over.account ?? "guest",
      email: over.account && over.account !== "guest" ? "k•••@•••.com" : null,
      emailVisible: false,
      identities: over.account === "google" ? [{ provider: "google", created_at: hoursAgo(100), last_sign_in_at: null }] : [],
      lastSignInAt: hoursAgo(3),
      isAdmin: false,
    },
    stats: {
      streak: 3,
      bestStreak: 9,
      freezes: 1,
      shieldAt: null,
      lastClearDate: null,
      attempts: 40,
      clears: 31,
      dailyClears: 12,
      flagged: over.flagged ?? 0,
      badges: 2,
    },
    attempts: [],
    reportsReceived: over.openReport
      ? [
          {
            id: "r1",
            ref: "R-0001",
            reason: "harassment",
            status: "open",
            created_at: hoursAgo(5),
            resolution: null,
            target_type: "player",
          },
        ]
      : [],
    reportsMade: [],
    moderation: [],
    audit: [
      {
        id: 1,
        actor_id: "a",
        actor: "senya@example.com",
        action: "player.sparks",
        target: `player:${ID}`,
        detail: { reason: "lost Sparks bug" },
        created_at: hoursAgo(30),
      },
    ],
    league: [],
    inventory: [],
    sparks: [{ id: 1, source: "admin", amount: 50, created_at: hoursAgo(30) }],
    ratings: [],
    rankMoves: [],
    boardGames: [],
  };
}

afterEach(cleanup);

describe("admin player page", () => {
  it("explains a guest aged 13 to 15 and lists what needs action", () => {
    data = detail({ openReport: true, flagged: 2 });
    render(<PlayerDetail id={ID} role="owner" backHref="/admin/players" />);
    expect(screen.getByRole("heading", { level: 1, name: "Kofi" })).toBeTruthy();
    expect(screen.getByText("Guest", { selector: "span[class*=font-bold]" })).toBeTruthy();
    expect(screen.getByText(/Lost progress can't be recovered/)).toBeTruthy();
    expect(screen.getByText(/Most protected: invite-only friends/)).toBeTruthy();
    expect(screen.getAllByText("Active today").length).toBeGreaterThan(0);
    const attention = screen.getByRole("region", { name: "Needs your attention" });
    expect(within(attention).getByText("1 report waiting for review.")).toBeTruthy();
    expect(within(attention).getByText(/2 suspicious scores waiting for review/)).toBeTruthy();
    expect(
      within(attention)
        .getByRole("link", { name: /Open Reports/ })
        .getAttribute("href"),
    ).toBe("/admin/moderation");
    // Team actions read as sentences, with who and why.
    expect(screen.getByText("Changed their Sparks")).toBeTruthy();
    expect(screen.getByText("Reason given: lost Sparks bug")).toBeTruthy();
    expect(screen.getByText("Changed by the team")).toBeTruthy();
  });

  it("keeps the player id and raw data folded under Technical details", () => {
    data = detail();
    render(<PlayerDetail id={ID} role="owner" backHref="/admin/players" />);
    const id = screen.getByText(ID);
    const fold = id.closest("details");
    expect(fold).not.toBeNull();
    expect(fold!.open).toBe(false);
    expect(within(fold!).getByText("Technical details")).toBeTruthy();
    expect(screen.queryByText("player.sparks")).toBeNull();
  });

  it("says when nothing needs action, and explains a saved adult account", () => {
    data = detail({ account: "google", band: "18+" });
    render(<PlayerDetail id={ID} role="owner" backHref="/admin/players" />);
    expect(screen.getByText(/Nothing needs action/)).toBeTruthy();
    expect(screen.getByText("Saved account (Google)")).toBeTruthy();
    expect(screen.getByText(/Progress is safe on any device/)).toBeTruthy();
    expect(screen.getByText(/including 18\+ party rooms/)).toBeTruthy();
  });

  it("shows a ban with when it ends, and offers Lift ban instead of Ban", () => {
    data = detail({ banned: true });
    render(<PlayerDetail id={ID} role="owner" backHref="/admin/players" />);
    expect(screen.getByText(/The ban ends in 3 days/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lift ban" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ban from playing" })).toBeNull();
  });

  it("an analyst sees the page read-only", () => {
    data = detail();
    render(<PlayerDetail id={ID} role="analyst" backHref="/admin/players" />);
    expect(screen.getByText("Your role can view players, not change them.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
  });
});

describe("admin players list", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: ID,
    nickname: "Kofi",
    account_type: "guest",
    providers: [],
    email: null,
    age_band: "13-15",
    level: 4,
    xp: 1200,
    sparks: 1340,
    streak: 3,
    best_streak: 9,
    freezes: 0,
    last_active: hoursAgo(2),
    created_at: "2026-11-04T10:00:00Z",
    banned_at: null,
    banned_until: null,
    ranking_revoked: false,
    is_test: false,
    flagged: 1,
    reports_open: 2,
    reports_total: 3,
    ...over,
  });

  it("leads with the player, their standing and what needs review, in words", () => {
    data = { rows: [row()], page: 1, pageSize: 25, total: 1, emailVisible: false };
    render(<PlayersPage canModerate canExport emailVisible={false} />);
    expect(screen.getByRole("heading", { level: 1, name: "Players" })).toBeTruthy();
    expect(screen.getByText(/Find a player and open their page/)).toBeTruthy();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    // Owner's order (11 Nov): who they are, then activity and progress; review and status at the end.
    expect(headers.slice(1, 7)).toEqual(["Player", "Email", "Account", "Joined", "Last played", "Level"]);
    expect(headers.slice(-2)).toEqual(["To review", "Status"]);
    const table = within(screen.getByRole("table"));
    expect(table.getByRole("link", { name: "Kofi" })).toBeTruthy();
    expect(table.getByText("In good standing")).toBeTruthy();
    expect(table.getByText("2 reports")).toBeTruthy();
    expect(table.getByText("1 suspicious score")).toBeTruthy();
    expect(table.getByText("2 hours ago")).toBeTruthy();
    expect(table.getByText("13 to 15")).toBeTruthy();
    expect(table.getByText("1,340")).toBeTruthy();
  });

  it("says what to do when filters match nobody", () => {
    window.history.replaceState(null, "", "/admin/players?status=banned");
    data = { rows: [], page: 1, pageSize: 25, total: 0, emailVisible: false };
    render(<PlayersPage canModerate={false} canExport={false} emailVisible={false} />);
    expect(screen.getByText(/No players match these filters/)).toBeTruthy();
    window.history.replaceState(null, "", "/admin/players");
  });
});
