// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

/**
 * Games page state (owner request, 11 Nov): each row shows On / In testing / Off / Retired, the page filters by state
 * with counts, and the row's three-way switch asks before players lose a game. Only the owner can switch.
 */
const data: { rows: unknown[]; export: Record<string, unknown> } = { rows: [], export: {} };
const flips: unknown[] = [];
vi.mock("@/lib/client/admin", () => ({
  useAdminQuery: () => ({ isPending: false, error: null, data }),
  useAdminAction: (_m: string, path: string) => ({
    mutate: (input: unknown) => {
      if (path === "/api/admin/games/state") flips.push(input);
    },
    isPending: false,
    error: null,
  }),
  errorText: (e: unknown) => String(e),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: unknown; href: string }) => (
    <a href={href} {...rest}>
      {children as never}
    </a>
  ),
}));
vi.mock("@/components/world/GameIcon3D", () => ({ GameIcon3D: () => <span /> }));
vi.mock("@/components/admin/PuzzlePreview", () => ({ PracticeBoardPreview: () => <span /> }));

import { LibraryMetaPage } from "@/components/admin/LibraryMetaPage";
import { adminCopy } from "@/lib/copy/admin";

const C = adminCopy.library;
const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  typicalSec: 120,
  tags: [],
  rule: "Rule",
  blurb: "Card",
  default: { typicalSec: 120, tags: [], rule: "Rule", blurb: "Card" },
  overridden: false,
  retired: false,
  state: "on",
  versusEligible: false,
  versus: true,
  hasPractice: true,
  practiceOff: false,
  ...extra,
});

beforeEach(() => {
  flips.length = 0;
  data.rows = [
    row("crownfall", { versusEligible: true }),
    row("pinned", { state: "testing" }),
    row("dusk", { state: "off" }),
    { ...row("blackout"), retired: true, state: undefined },
  ];
});
afterEach(cleanup);

const rowOf = (id: string) => document.querySelector(`[data-meta-row="${id}"]`) as HTMLElement;

describe("Games page: state", () => {
  it("shows each game's state in its collapsed row", () => {
    render(<LibraryMetaPage canWrite canSwitch />);
    expect(rowOf("crownfall").dataset.state).toBe("on");
    expect(within(rowOf("pinned")).getAllByText(C.states.testing.label).length).toBeGreaterThan(0);
    expect(within(rowOf("dusk")).getAllByText(C.states.off.label).length).toBeGreaterThan(0);
    expect(within(rowOf("blackout")).getAllByText(C.states.retired.label).length).toBeGreaterThan(0);
  });

  it("filters by state, with a count on every filter (zero too)", () => {
    render(<LibraryMetaPage canWrite canSwitch />);
    const tabs = screen.getByRole("tablist", { name: C.show });
    const tab = (id: string) => tabs.querySelector(`[data-filter="${id}"]`) as HTMLElement;
    expect(tab("all").textContent).toContain("4");
    expect(tab("on").textContent).toContain("1");
    expect(tab("testing").textContent).toContain("1");
    expect(tab("off").textContent).toContain("1");
    expect(tab("retired").textContent).toContain("1");
    fireEvent.click(tab("testing"));
    expect(rowOf("pinned")).toBeTruthy();
    expect(rowOf("crownfall")).toBeNull();
  });

  it("asks before players lose a game, saying what they lose, and switches it back On at once", () => {
    render(<LibraryMetaPage canWrite canSwitch />);
    const group = within(rowOf("crownfall")).getByRole("radiogroup");
    fireEvent.click(within(group).getByRole("radio", { name: new RegExp(C.states.off.label) }));
    expect(flips).toEqual([]);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Players will no longer see or play");
    expect(dialog.textContent).toContain("Nobody can open it");
    fireEvent.click(within(dialog).getByRole("button", { name: C.confirmOff }));
    expect(flips).toEqual([{ id: "crownfall", state: "off" }]);

    const off = within(rowOf("dusk")).getByRole("radiogroup");
    fireEvent.click(within(off).getByRole("radio", { name: new RegExp(`^${C.states.on.label}$`) }));
    expect(flips).toContainEqual({ id: "dusk", state: "on" });
  });

  it("puts a game In testing after a confirm that says only the team can open it, and offers Try it", () => {
    render(<LibraryMetaPage canWrite canSwitch />);
    const group = within(rowOf("crownfall")).getByRole("radiogroup");
    fireEvent.click(within(group).getByRole("radio", { name: new RegExp(C.states.testing.label) }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Only the team can still open it");
    fireEvent.click(within(dialog).getByRole("button", { name: C.confirmTesting }));
    expect(flips).toEqual([{ id: "crownfall", state: "testing" }]);
    expect(rowOf("pinned").querySelector("[data-try-it]")?.getAttribute("href")).toBe("/play/pinned?mode=free");
  });

  it("has the Duels and Parties switch only where the game can be raced, and the practice switch", () => {
    render(<LibraryMetaPage canWrite canSwitch />);
    const versus = within(rowOf("crownfall")).getByRole("switch", { name: C.versusAria("Crownfall") });
    expect(versus.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(versus);
    expect(flips).toContainEqual({ id: "crownfall", versus: false });
    expect(within(rowOf("pinned")).queryByRole("switch", { name: /Duels and Parties/ })).toBeNull();
    fireEvent.click(within(rowOf("pinned")).getByRole("switch", { name: /practice round/ }));
    expect(flips).toContainEqual({ id: "pinned", practice: false });
  });

  it("lets content editors see the switches but not use them, and says why", () => {
    render(<LibraryMetaPage canWrite canSwitch={false} />);
    expect(screen.getByText(C.switchReadOnly)).toBeTruthy();
    for (const r of within(rowOf("crownfall")).getAllByRole("radio")) expect((r as HTMLButtonElement).disabled).toBe(true);
    expect((within(rowOf("crownfall")).getByRole("switch", { name: /practice round/ }) as HTMLButtonElement).disabled).toBe(true);
    // Retired games have no switches at all.
    expect(within(rowOf("blackout")).queryByRole("radiogroup")).toBeNull();
  });
});
