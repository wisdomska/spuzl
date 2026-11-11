import { describe, expect, it } from "vitest";
import { GAMES, RETIRED_GAMES } from "@/lib/catalog";
import {
  STATE_FILTERS,
  STATUS_OF,
  byState,
  closedNow,
  defaultState,
  rowState,
  stateChangeProblem,
  stateCounts,
  stateFromStatus,
  switchFromRows,
} from "./index";

const sw = (testing: string[] = [], off: string[] = [], noVersus: string[] = []) => ({
  "games.testing": testing,
  "games.off": off,
  "games.noVersus": noVersus,
});

describe("game state: stored status", () => {
  it("stores On, In testing and Off as live, testing and off", () => {
    expect(STATUS_OF).toEqual({ on: "live", testing: "testing", off: "off" });
    for (const [state, status] of Object.entries(STATUS_OF)) expect(stateFromStatus(status)).toBe(state);
  });

  it("reads the older values no wider than before, and leaves retired and unknown ones to the code", () => {
    expect(stateFromStatus("coming_soon")).toBe("testing");
    expect(stateFromStatus("hidden")).toBe("off");
    expect(stateFromStatus("retired")).toBeUndefined();
    expect(stateFromStatus("paused")).toBeUndefined();
    expect(stateFromStatus(null)).toBeUndefined();
  });
});

describe("game state: the runtime switch from the games rows", () => {
  it("puts every game On when the rows say live (today's database)", () => {
    const s = switchFromRows(GAMES.map((g) => ({ id: g.id, status: "live", versus: true })));
    expect(s).toEqual(sw());
  });

  it("lists the games In testing, Off and kept out of Duels and Parties", () => {
    const s = switchFromRows([
      { id: "pinned", status: "testing" },
      { id: "crownfall", status: "off" },
      { id: "sixer", status: "live", versus: false },
      { id: "dusk", status: "coming_soon" },
    ]);
    // In catalogue order; the old lab status reads as In testing.
    expect(s["games.testing"]).toEqual(["dusk", "pinned"]);
    expect(s["games.off"]).toEqual(["crownfall"]);
    expect(s["games.noVersus"]).toEqual(["sixer"]);
  });

  it("keeps a game's default when its row is missing, retired or unreadable (before the migration)", () => {
    const s = switchFromRows([{ id: "crownfall", status: "retired" }, { id: "dusk" }]);
    expect(s).toEqual(sw());
    for (const g of GAMES) expect(defaultState(g.id), g.id).toBe(g.lab ? "testing" : "on");
  });

  it("ignores rows of retired and unknown games", () => {
    const s = switchFromRows([...RETIRED_GAMES.map((g) => ({ id: g.id, status: "off" })), { id: "nope", status: "off" }]);
    expect(s["games.off"]).toEqual([]);
  });
});

describe("game state: what players lose", () => {
  it("names the games that left players (to In testing or Off), not the ones that came back", () => {
    expect(closedNow(sw(), sw(["pinned"]))).toEqual(["pinned"]);
    expect(closedNow(sw(), sw([], ["crownfall"]))).toEqual(["crownfall"]);
    expect(closedNow(sw(["pinned"]), sw([], ["pinned"]))).toEqual([]);
    expect(closedNow(sw(["pinned"]), sw())).toEqual([]);
    expect(closedNow(sw(), sw([], [], ["sixer"]))).toEqual([]);
  });
});

describe("game state: the Games page filter", () => {
  const rows = [
    { id: "crownfall", state: "on" as const },
    { id: "pinned", state: "testing" as const },
    { id: "dusk", state: "off" as const },
    { id: "sixer" },
    { id: "blackout", retired: true },
  ];

  it("offers All, On, In testing, Off and Retired", () => {
    expect(STATE_FILTERS).toEqual(["all", "on", "testing", "off", "retired"]);
  });

  it("reads each row's state (no state means On; retired wins)", () => {
    expect(rows.map(rowState)).toEqual(["on", "testing", "off", "on", "retired"]);
    expect(rowState({ id: "blackout", state: "on" })).toBe("retired");
  });

  it("filters and counts, zero included", () => {
    expect(byState(rows, "all")).toHaveLength(5);
    expect(byState(rows, "on").map((r) => r.id)).toEqual(["crownfall", "sixer"]);
    expect(byState(rows, "testing").map((r) => r.id)).toEqual(["pinned"]);
    expect(byState(rows, "off").map((r) => r.id)).toEqual(["dusk"]);
    expect(byState(rows, "retired").map((r) => r.id)).toEqual(["blackout"]);
    expect(stateCounts(rows)).toEqual({ all: 5, on: 2, testing: 1, off: 1, retired: 1 });
    expect(stateCounts([])).toEqual({ all: 0, on: 0, testing: 0, off: 0, retired: 0 });
  });
});

describe("game state: what the server accepts", () => {
  it("takes a known state for a game that is not retired", () => {
    expect(stateChangeProblem("crownfall", "off")).toBeNull();
    expect(stateChangeProblem("crownfall", "testing")).toBeNull();
    expect(stateChangeProblem("crownfall", "on")).toBeNull();
  });

  it("refuses unknown games, retired games and unknown states", () => {
    expect(stateChangeProblem("nope", "on")).toBe("unknown_game");
    expect(stateChangeProblem("blackout", "on")).toBe("game_retired");
    expect(stateChangeProblem("crownfall", "paused")).toBe("invalid_state");
    expect(stateChangeProblem("crownfall", "retired")).toBe("invalid_state");
  });
});
