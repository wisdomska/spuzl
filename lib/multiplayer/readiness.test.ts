import { describe, expect, it } from "vitest";
import { readiness, shortNames } from "./readiness";
import { partyCopy } from "@/lib/copy/party";

const p = (id: string, ready: boolean, o: { left?: boolean; spectator?: boolean } = {}) => ({ id, nickname: id, ready, ...o });

describe("readiness (R3-01)", () => {
  it("opens Start only when every present racer is ready", () => {
    expect(readiness([p("host", true), p("ama", true)]).all).toBe(true);
    const r = readiness([p("host", true), p("ama", false)]);
    expect(r.all).toBe(false);
    expect(r.waiting.map((x) => x.id)).toEqual(["ama"]);
  });

  it("needs two racers to start at all", () => {
    expect(readiness([p("host", true)]).all).toBe(false);
    expect(readiness([p("host", true)]).canStartWithout).toBe(false);
  });

  it("offers Start without them only when at least two are ready", () => {
    expect(readiness([p("host", true), p("ama", false)]).canStartWithout).toBe(false);
    const r = readiness([p("host", true), p("ama", true), p("kofi", false)]);
    expect(r.canStartWithout).toBe(true);
    expect(r.ready.map((x) => x.id)).toEqual(["host", "ama"]);
  });

  it("ignores players who left and spectators (a classroom host)", () => {
    const r = readiness([p("teacher", true, { spectator: true }), p("ama", true), p("kofi", true), p("yaw", false, { left: true })]);
    expect(r.racers.map((x) => x.id)).toEqual(["ama", "kofi"]);
    expect(r.all).toBe(true);
  });

  it("keeps the waiting list compact", () => {
    expect(shortNames(["a", "b"])).toEqual({ shown: ["a", "b"], more: 0 });
    expect(shortNames(["a", "b", "c", "d", "e"])).toEqual({ shown: ["a", "b", "c"], more: 2 });
    expect(partyCopy.lobby.waitingFor(["Ama"], 0)).toBe("Waiting for Ama");
    expect(partyCopy.lobby.waitingFor(["Ama", "Kofi"], 0)).toBe("Waiting for Ama and Kofi");
    expect(partyCopy.lobby.waitingFor(["Ama", "Kofi", "Yaw"], 2)).toBe("Waiting for Ama, Kofi, Yaw and 2 more");
  });
});
