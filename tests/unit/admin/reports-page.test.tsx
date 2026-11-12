// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * Admin overhaul, Reports (was Moderation): plain status words, the reference only under Technical details, and
 * actions that take something away from a player ask once more, in words, before they run.
 */
const byKey: Record<string, unknown> = {};
const mutateAsync = vi.fn(async () => ({ nickname: null }));
vi.mock("@/lib/client/admin", () => ({
  useAdminQuery: (key: unknown[]) => ({ isPending: false, error: null, data: byKey[String(key[0])] }),
  useAdminAction: () => ({ mutate: vi.fn(), mutateAsync, reset: vi.fn(), isPending: false, error: null, data: null }),
  errorText: (e: unknown) => String(e),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children as never}</a>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/moderation",
}));

import { ModerationQueue } from "@/components/admin/ModerationQueue";

const PID = "6f1c2a3b-0000-4000-8000-000000000002";
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

byKey.moderation = {
  rows: [{ id: "r1", ref: "R-AB12", title: "Kofi · Harassment", kind: "Player", status: "open", created_at: ago(2), player_id: PID }],
  page: 1,
  pageSize: 25,
  total: 1,
  counts: { reports: 1, nicknames: 0, party: 0, flagged: 0 },
  open: 1,
};
byKey.report = {
  report: {
    ref: "R-AB12",
    reason: "harassment",
    status: "open",
    target_type: "player",
    target_id: PID,
    created_at: ago(2),
    resolution: null,
  },
  target: {
    id: PID,
    nickname: "Kofi",
    created_at: ago(24 * 2),
    banned_at: null,
    banned_until: null,
    ranking_revoked: false,
    reports: 3,
    flagged: 0,
  },
  reporter: { nickname: "Ama" },
  related: [],
  blockDays: null,
};

afterEach(cleanup);

describe("admin Reports page", () => {
  it("reads in plain words and keeps the reference folded away", () => {
    render(<ModerationQueue canWrite />);
    expect(screen.getByRole("heading", { level: 1, name: "Reports" })).toBeTruthy();
    expect(screen.getByText("1 to review")).toBeTruthy();
    expect(screen.getAllByText("To review").length).toBeGreaterThan(0);
    expect(screen.getByText("Report about Kofi")).toBeTruthy();
    expect(screen.getByText("Reported by Ama 2 hours ago.")).toBeTruthy();
    expect(screen.getByText("New account")).toBeTruthy();
    expect(screen.getByText("R-AB12").closest("details")?.open).toBe(false);
    expect(screen.getByRole("link", { name: /Open player page/ }).getAttribute("href")).toBe(`/admin/players/${PID}`);
  });

  it("asks before resetting a player's times, and only runs on Yes", async () => {
    render(<ModerationQueue canWrite />);
    fireEvent.click(screen.getByRole("button", { name: "Reset times" }));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText("Reset times?")).toBeTruthy();
    expect(screen.getByText(/Removes Daily scores, ratings and streak/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes, reset times" }));
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ pid: PID, action: "reset" }));
  });
});
