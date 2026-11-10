import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { openInkPass, signInkPass, type InkPass } from "./ink-pass";
import { serverOnlyTopic } from "@/lib/realtime/server";

const now = 1_800_000_000_000;
const pass: InkPass = { m: "match-1", s: 1, r: 2, p: "drawer-1", x: now + 60_000 };

describe("Draw It ink pass (R4-24)", () => {
  it("opens a pass this server signed, until it expires", () => {
    const t = signInkPass(pass, "secret");
    expect(openInkPass(t, now, "secret")).toEqual(pass);
    expect(openInkPass(t, now + 60_001, "secret")).toBeNull();
  });

  it("refuses a pass signed with another key, a changed body, or junk", () => {
    const t = signInkPass(pass, "secret");
    expect(openInkPass(t, now, "other")).toBeNull();
    const [, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...pass, p: "someone-else" })).toString("base64url");
    expect(openInkPass(`${forged}.${sig}`, now, "secret")).toBeNull();
    expect(openInkPass("x.y", now, "secret")).toBeNull();
    expect(openInkPass(`${t}.extra`, now, "secret")).toBeNull();
    expect(openInkPass(42, now, "secret")).toBeNull();
    expect(openInkPass("a".repeat(500), now, "secret")).toBeNull();
  });

  it("the ink channel is server-written; match and user channels are not", () => {
    expect(serverOnlyTopic("ink:abc")).toBe(true);
    expect(serverOnlyTopic("match:abc")).toBe(false);
    expect(serverOnlyTopic("user:abc")).toBe(false);
  });
});
