import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({}) }));
import { REALTIME_FREE_MONTHLY, recipientsFor } from "./usage";

/** Owner, 13 Nov 2026: the live-message estimate counts one delivery per player in the room. */
describe("live-message estimate", () => {
  it("counts the people each broadcast reaches", () => {
    const size = (id: string) => (id === "m1" ? 7 : undefined);
    expect(recipientsFor("match:m1", size)).toBe(7);
    expect(recipientsFor("ink:m1", size)).toBe(7);
    expect(recipientsFor("match:unknown", size)).toBe(2);
    expect(recipientsFor("bay:b1", size)).toBe(2);
    expect(recipientsFor("user:p1", size)).toBe(1);
  });
  it("measures against the free plan's 2 million a month", () => {
    expect(REALTIME_FREE_MONTHLY).toBe(2_000_000);
  });
});
