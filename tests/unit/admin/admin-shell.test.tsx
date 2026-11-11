// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

/** Admin overhaul: the grouped sidebar (Home, Players, Games & content, Shop, Insights, Settings). */
let path = "/admin";
let counts: Record<string, number | null> | undefined;
vi.mock("next/navigation", () => ({ usePathname: () => path, useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: unknown; href: string }) => (
    <a href={href} {...rest}>
      {children as never}
    </a>
  ),
}));
vi.mock("@/lib/client/admin", () => ({ useAdminMe: () => ({ data: counts ? { counts } : undefined }) }));
vi.mock("@/lib/client/admin-auth", () => ({ adminSignOut: vi.fn() }));

import { AdminShell } from "@/components/admin/AdminShell";

const sidebar = () => screen.getAllByRole("navigation", { name: "Admin" })[0];

beforeEach(() => {
  path = "/admin";
  counts = undefined;
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
});
afterEach(cleanup);

describe("admin sidebar", () => {
  it("groups an owner's pages under plain headings, with the new names", () => {
    render(
      <AdminShell role="owner" email="owner@example.com">
        <p>page</p>
      </AdminShell>,
    );
    const nav = within(sidebar());
    for (const g of ["Players", "Games & content", "Insights", "Settings"])
      expect(nav.getByRole("button", { name: new RegExp(`^${g}`) })).toBeTruthy();
    for (const l of ["Overview", "Reports", "Games", "Daily calendar", "Shop", "Live now", "Activity log", "Team"])
      expect(nav.getByRole("link", { name: new RegExp(`^${l}`) })).toBeTruthy();
    // Feature switches were removed: nothing read them (Game settings switches what players see).
    expect(nav.queryByRole("link", { name: /^Feature switches/ })).toBeNull();
    // URLs did not change
    expect(nav.getByRole("link", { name: /^Reports/ }).getAttribute("href")).toBe("/admin/moderation");
    expect(nav.getByRole("link", { name: /^Activity log/ }).getAttribute("href")).toBe("/admin/audit");
  });

  it("shows only what the role can open, and drops empty groups", () => {
    render(
      <AdminShell role="analyst" email={null}>
        <p>page</p>
      </AdminShell>,
    );
    const nav = within(sidebar());
    expect(nav.queryByRole("link", { name: /^Reports/ })).toBeNull();
    expect(nav.queryByRole("link", { name: /^Team/ })).toBeNull();
    expect(nav.queryByRole("button", { name: /^Games & content/ })).toBeTruthy(); // Daily calendar, Daily Five, Puzzles
    expect(nav.getByRole("link", { name: /^Activity log/ })).toBeTruthy();
  });

  it("marks the current page and keeps counts on their items", () => {
    path = "/admin/moderation";
    counts = { puzzles: 900, moderation: 3, review: 2, content: 0, feedback: 5 };
    render(
      <AdminShell role="owner" email="o@example.com">
        <p>page</p>
      </AdminShell>,
    );
    const nav = within(sidebar());
    const reports = nav.getByRole("link", { name: /^Reports/ });
    expect(reports.getAttribute("aria-current")).toBe("page");
    expect(reports.textContent).toContain("3");
    expect(nav.getByRole("link", { name: /^Feedback/ }).textContent).toContain("5 new");
    // puzzles count what waits for review, not every puzzle
    expect(nav.getByRole("link", { name: /^Puzzles/ }).textContent).toContain("2 to review");
    expect(nav.getByRole("link", { name: /^Content/ }).textContent).not.toMatch(/\d/);
  });

  it("folds a group shut, shows its total, and remembers it", () => {
    counts = { puzzles: 0, moderation: 3, review: 0, content: 0, feedback: 5 };
    const { unmount } = render(
      <AdminShell role="owner" email="o@example.com">
        <p>page</p>
      </AdminShell>,
    );
    const toggle = within(sidebar()).getByRole("button", { name: /^Players/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("8 waiting");
    expect(within(sidebar()).queryByRole("link", { name: /^Reports/ })).toBeNull();
    unmount();
    render(
      <AdminShell role="owner" email="o@example.com">
        <p>page</p>
      </AdminShell>,
    );
    expect(
      within(sidebar())
        .getByRole("button", { name: /^Players/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("keeps the current page's group open even when it was folded before", () => {
    try {
      localStorage.setItem("spuzl.admin.nav.closed", "settings");
    } catch {
      /* no storage */
    }
    path = "/admin/team";
    render(
      <AdminShell role="owner" email="o@example.com">
        <p>page</p>
      </AdminShell>,
    );
    expect(within(sidebar()).getByRole("link", { name: /^Team/ }).getAttribute("aria-current")).toBe("page");
  });

  it("puts the menu behind a Menu button on drill-in pages", () => {
    path = "/admin/puzzles/abc";
    render(
      <AdminShell role="owner" email="o@example.com">
        <p>page</p>
      </AdminShell>,
    );
    expect(screen.queryByRole("navigation", { name: "Admin" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Menu/ }));
    expect(within(screen.getByRole("navigation", { name: "Admin" })).getByRole("link", { name: /^Puzzles/ })).toBeTruthy();
  });
});
