import { describe, expect, it } from "vitest";
import { backAction } from "@/lib/client/nav";

describe("backAction (SPZ-25)", () => {
  it("goes to the Grid when the page was opened directly", () => {
    expect(backAction({ entry: "/duel", navigated: false, current: "/duel" })).toBe("home");
  });
  it("goes to the Grid before the tracker has recorded anything", () => {
    expect(backAction({ entry: null, navigated: false, current: "/party" })).toBe("home");
  });
  it("uses history after an in-app navigation", () => {
    expect(backAction({ entry: "/", navigated: true, current: "/duel" })).toBe("back");
  });
  it("goes to the Grid when back on the landing page (history would leave the app)", () => {
    expect(backAction({ entry: "/duel", navigated: true, current: "/duel" })).toBe("home");
  });
});
