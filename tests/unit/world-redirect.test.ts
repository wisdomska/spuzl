import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { MERGED_WORLDS, WORLDS } from "@/lib/catalog";

/** Old /world links of the worlds folded in the 2026-11 regroup answer a 308 to their group (proxy.ts). */
describe("folded world redirects", () => {
  // No Supabase in unit tests: the proxy then passes every other request straight through.
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  const go = (path: string) => proxy(new NextRequest(`http://localhost${path}`));

  it("sends each folded world to the group that took its games", async () => {
    const want = { line: "logic", shape: "logic", clue: "word", rage: "reflex" };
    expect(MERGED_WORLDS).toEqual(want);
    for (const [from, to] of Object.entries(want)) {
      const r = await go(`/world/${from}`);
      expect(r.status, from).toBe(308);
      expect(r.headers.get("location"), from).toBe(`http://localhost/world/${to}`);
    }
    expect((await go("/world/rage/?x=1")).headers.get("location")).toBe("http://localhost/world/reflex?x=1");
  });

  it("leaves the live groups to the page", async () => {
    for (const path of [...WORLDS.map((w) => `/world/${w.id}`), "/world/line/extra"]) {
      const r = await go(path);
      expect(r.status, path).not.toBe(308);
      expect(r.headers.get("location"), path).toBeNull();
      expect(r.headers.get("x-middleware-rewrite"), path).toBeNull();
    }
  });

  it("answers unknown and emptied worlds with a real 404 (a rewrite to a path no route matches), not a soft 404", async () => {
    for (const path of ["/world/number", "/world/nope", "/world/puzzles", "/world/Logic"]) {
      const r = await go(path);
      expect(r.headers.get("location"), path).toBeNull();
      expect(r.headers.get("x-middleware-rewrite"), path).toBe("http://localhost/__not-found");
    }
  });
});
