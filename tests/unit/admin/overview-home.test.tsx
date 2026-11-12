// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

/** Admin overhaul: the Overview leads with what needs attention, then today's numbers in plain words. */
let data: unknown = null;
vi.mock("@/lib/client/admin", () => ({
  useAdminQuery: () => ({ isPending: false, error: null, data }),
  errorText: (e: unknown) => String(e),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children as never}</a>,
}));

import { Overview } from "@/components/admin/Overview";

const base = {
  players: {
    players: 1200,
    guests: 800,
    signed_in: 400,
    by_method: { guest: 800, email: 300, google: 100 },
    by_age: { "13-15": 300, "16-17": 300, "18+": 600 },
    new_today: 12,
    new_7d: 90,
    active_today: 150,
    active_7d: 600,
    banned: 2,
  },
  kpis: { dau: 120, open_reports: 0, flagged: 0, players_now: 7, dau_yesterday: 140, clears_today: 310 },
};

afterEach(cleanup);
const attention = () => within(screen.getByRole("region", { name: "Needs your attention" }));

describe("admin Overview: home", () => {
  it("says all clear when nothing is waiting", () => {
    data = { ...base, newFeedback: 0, attention: { puzzlesToReview: 0, contentToReview: 0, joinRequestsToday: 0, joinRequestsWaiting: 0 } };
    render(<Overview role="owner" />);
    expect(attention().getByText("All clear. Nothing waiting.")).toBeTruthy();
    expect(attention().getAllByText("Nothing waiting").length).toBe(5);
  });

  it("lists the work waiting, biggest first, with a verb to go and do it", () => {
    data = {
      ...base,
      kpis: { ...base.kpis, open_reports: 3, flagged: 1 },
      newFeedback: 9,
      attention: { puzzlesToReview: 2, contentToReview: null, joinRequestsToday: 4, joinRequestsWaiting: 1 },
    };
    render(<Overview role="owner" />);
    const rows = attention().getAllByRole("listitem");
    expect(rows[0].textContent).toContain("New messages from players");
    expect(rows[1].textContent).toContain("Player reports to look at");
    expect(
      within(rows[1])
        .getByRole("link", { name: /Review reports/ })
        .getAttribute("href"),
    ).toBe("/admin/moderation");
    // content is hidden for a role that can't open it (null); join requests are information, last
    expect(attention().queryByText("Content waiting for approval")).toBeNull();
    expect(rows[rows.length - 1].textContent).toContain("Join requests today");
    expect(rows[rows.length - 1].textContent).toContain("1 waiting on the host");
  });

  it("shows today's numbers in plain words with yesterday for comparison", () => {
    data = base;
    render(<Overview role="analyst" />);
    expect(screen.getByText("Playing right now")).toBeTruthy();
    expect(screen.getByText("Played a game today")).toBeTruthy();
    expect(screen.getByText("Yesterday: 140 for the whole day.")).toBeTruthy();
    expect(screen.getByText("1,200")).toBeTruthy();
    expect(screen.getByText("18 and over")).toBeTruthy();
    expect(screen.getByText("600 (50%)")).toBeTruthy();
    // no jargon on the page
    expect(document.body.textContent).not.toMatch(/\bDAU\b|\bD1\b|\bp95\b|\bms\b/);
  });

  it("offers shortcuts the role can use", () => {
    data = base;
    render(<Overview role="analyst" />);
    expect(screen.getByText("Find a player")).toBeTruthy();
    expect(screen.queryByText("Add someone to the team")).toBeNull();
    cleanup();
    render(<Overview role="owner" />);
    expect(screen.getByText("Add someone to the team")).toBeTruthy();
  });

  it("explains a failed load in plain words", async () => {
    vi.resetModules();
    vi.doMock("@/lib/client/admin", () => ({
      useAdminQuery: () => ({ isPending: false, error: new Error("boom"), data: undefined }),
      errorText: () => "x",
    }));
    const { Overview: Fresh } = await import("@/components/admin/Overview");
    render(<Fresh role="owner" />);
    expect(screen.getByText(/Overview didn't load/)).toBeTruthy();
    vi.doUnmock("@/lib/client/admin");
  });
});
