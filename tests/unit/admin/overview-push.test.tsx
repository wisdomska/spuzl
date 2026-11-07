// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/** R2-ADMIN: the admin Overview shows how many devices have push alerts on, and how many a push reached lately. */
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
    players: 10,
    guests: 6,
    signed_in: 4,
    by_method: {},
    by_age: {},
    new_today: 1,
    new_7d: 3,
    active_today: 2,
    active_7d: 5,
    banned: 0,
  },
  kpis: { dau: 2, open_reports: 0, flagged: 0 },
};

afterEach(cleanup);

describe("admin Overview: push alerts", () => {
  it("shows devices with alerts on and those reached in 30 days", () => {
    data = { ...base, push: { devices: 1234, reached30d: 987 } };
    render(<Overview canModerate />);
    expect(screen.getByText("Devices with alerts on")).toBeTruthy();
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("Devices a push reached, last 30 days")).toBeTruthy();
    expect(screen.getByText("987")).toBeTruthy();
  });
  it("hides the tiles when an older server sends no push numbers", () => {
    data = base;
    render(<Overview canModerate />);
    expect(screen.queryByText("Devices with alerts on")).toBeNull();
  });
});
