// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/components/world/GameIcon3D", () => ({ GameIcon3D: () => <span /> }));

import { GameSetRow } from "@/components/admin/SettingsPage";
import { SETTINGS } from "@/lib/game-settings/schema";
import { adminCopy } from "@/lib/copy/admin";

/**
 * Graduate (11 Nov 2026): every lab game is live, so "features.labGames" has no options. The Settings page keeps its
 * Lab games card and says plainly that no game is in testing, instead of an empty grid or a "0 of 0" count.
 */
afterEach(cleanup);

const row = (key: "features.labGames" | "practice.disabled") => ({
  key,
  def: SETTINGS[key],
  value: [] as string[],
  isDefault: true,
  updatedAt: null,
});

describe("admin Settings: Lab games with no game in testing", () => {
  it("shows the plain empty state, no cards and no count", () => {
    render(<GameSetRow row={row("features.labGames")} canWrite busy={false} onSave={() => {}} />);
    expect(screen.getByText("No games in testing right now")).toBeTruthy();
    expect(screen.getByRole("heading", { name: SETTINGS["features.labGames"].label })).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText(/of 0/)).toBeNull();
  });

  it("keeps the card grid for a set that has games (practice rounds)", () => {
    render(<GameSetRow row={row("practice.disabled")} canWrite busy={false} onSave={() => {}} />);
    expect(screen.getByRole("list", { name: SETTINGS["practice.disabled"].label }).querySelectorAll("li").length).toBe(
      SETTINGS["practice.disabled"].options.length,
    );
    expect(screen.queryByText(adminCopy.settings.setWords["features.labGames"].empty)).toBeNull();
  });
});
