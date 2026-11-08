import { describe, expect, it } from "vitest";
import { SETTLE_MS, decide, enterVisit, initialQueue, isQuietScreen, request, settleIn, withdraw, type QueueState } from "./queue";
import { PROMPT_PAIRS, PROMPT_PRIORITY, isPromptTrigger } from "./ids";

const at = (s: QueueState, now: number) => decide(s, now);

describe("prompt queue (R2-04)", () => {
  it("documents the priority: save streak, alerts, weekly recap, low data, event", () => {
    expect(PROMPT_PRIORITY).toEqual(["save_streak", "alerts", "weekly_recap", "low_data", "event"]);
  });

  it("grants nothing before the first visit or before the visit settles", () => {
    let s = request(initialQueue(), "alerts");
    expect(at(s, 10_000).active).toBeNull();
    s = enterVisit(s, "/library", 1000);
    expect(settleIn(s, 1000)).toBe(SETTLE_MS);
    expect(at(s, 1000 + SETTLE_MS - 1).active).toBeNull();
    expect(at(s, 1000 + SETTLE_MS).active).toBe("alerts");
  });

  it("gives the slot to the highest priority among prompts ready in the same visit", () => {
    let s = enterVisit(initialQueue(), "/me", 0);
    s = request(s, "event");
    s = request(s, "low_data");
    s = request(s, "alerts");
    s = at(s, SETTLE_MS);
    expect(s.active).toBe("alerts");
    expect(s.waiting).toEqual(["event", "low_data"]);
  });

  it("never shows two prompts in one visit, even after the first closes", () => {
    let s = enterVisit(initialQueue(), "/me", 0);
    s = at(request(s, "alerts"), SETTLE_MS);
    s = request(s, "low_data");
    expect(at(s, 5000).active).toBe("alerts");
    s = withdraw(s, "alerts"); // answered
    expect(s.active).toBeNull();
    expect(at(s, 9000).active).toBeNull();
    expect(settleIn(s, 9000)).toBeNull();
    // the next screen gets the waiting one
    s = enterVisit(s, "/friends", 10_000);
    expect(at(s, 10_000 + SETTLE_MS).active).toBe("low_data");
  });

  it("a late request on a fresh visit is granted at once; a request on a spent visit waits", () => {
    let s = enterVisit(initialQueue(), "/library", 0);
    s = at(request(s, "low_data"), 60_000);
    expect(s.active).toBe("low_data");
    s = enterVisit(withdraw(s, "low_data"), "/shop", 61_000);
    s = at(request(s, "event"), 70_000);
    expect(s.active).toBe("event");
  });

  it("an open prompt carries over a navigation and spends the new visit", () => {
    let s = enterVisit(initialQueue(), "/library", 0);
    s = at(request(s, "low_data"), SETTLE_MS);
    s = enterVisit(request(s, "alerts"), "/me", 2000);
    expect(s.active).toBe("low_data");
    expect(s.used).toBe(true);
    s = withdraw(s, "low_data");
    expect(at(s, 9000).active).toBeNull();
  });

  it("re-entering the same pathname is the same visit; withdrawing a waiting prompt drops it", () => {
    let s = enterVisit(initialQueue(), "/me", 0);
    expect(enterVisit(s, "/me", 5000)).toBe(s);
    s = withdraw(request(s, "event"), "event");
    expect(s.waiting).toEqual([]);
    expect(request(request(s, "event"), "event").waiting).toEqual(["event"]);
  });

  it("keeps overlay prompts off Home and play screens", () => {
    for (const p of [
      "/",
      "/play/crownfall",
      "/duel",
      "/party/ABCD",
      "/bay/123",
      "/ghost/sixer",
      "/challenge/x",
      "/welcome",
      "/intro",
      "/admin/metrics",
      "/dev/board/x",
    ])
      expect(isQuietScreen(p), p).toBe(true);
    for (const p of ["/library", "/friends", "/me", "/party", "/settings", "/leagues", "/players", "/world/logic", "/quests"])
      expect(isQuietScreen(p), p).toBe(false);
  });

  it("knows each prompt's triggers", () => {
    expect(isPromptTrigger("alerts", "friend")).toBe(true);
    expect(isPromptTrigger("alerts", "slow_loads")).toBe(false);
    expect(isPromptTrigger("nope", "friend")).toBe(false);
    expect(PROMPT_PAIRS.map((p) => `${p.prompt}.${p.trigger}`)).toContain("low_data.slow_net");
    for (const p of PROMPT_PAIRS) {
      expect(p.prompt).toMatch(/^[a-z_]{1,16}$/);
      expect(p.trigger).toMatch(/^[a-z_]{1,16}$/); // fits client_metrics.mode / kind
    }
  });
});
