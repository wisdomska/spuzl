import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, BASE, guest } from "./helpers";
import { adminSession, type AdminSession } from "./admin-helpers";

/**
 * R2-07 practice rounds, server side: the admin's per-game switch "practice.disabled" (a set of game ids, empty by
 * default) is range-checked, audited, served to clients, and the server stops serving that game's practice board
 * (the client then goes straight into the game). Run:
 *   API_BASE=http://localhost:3203 pnpm vitest run -c vitest.api.config.mts tests/api/practice.test.ts
 */
let owner: AdminSession;

beforeAll(async () => {
  owner = await adminSession("owner");
}, 120_000);

afterAll(async () => {
  await admin().from("game_settings").delete().eq("key", "practice.disabled");
});

describe("practice.disabled (admin cascade)", () => {
  it("defaults to every game having its practice round", async () => {
    const g = await guest();
    expect((await g.api("/api/v1/guided/dusk")).status).toBe(200);
    const pub = await fetch(`${BASE}/api/v1/settings/game`).then((r) => r.json());
    expect(pub["practice.disabled"]).toEqual([]);
  });

  it("takes only game ids, is audited, and turns that game's practice board off at once", async () => {
    const put = (value: unknown) => owner.aal2("/api/admin/settings", { method: "PUT", json: { key: "practice.disabled", value } });
    expect((await put(["dusk", "not-a-game"])).status).toBe(422);
    expect((await put("dusk")).status).toBe(422);
    expect((await put(["dusk"])).status).toBe(200);

    const pub = await fetch(`${BASE}/api/v1/settings/game`).then((r) => r.json());
    expect(pub["practice.disabled"]).toEqual(["dusk"]);

    const g = await guest();
    const off = await g.api("/api/v1/guided/dusk");
    expect(off.status).toBe(404);
    expect(off.data.error).toBe("practice_off");
    expect((await g.api("/api/v1/guided/crownfall")).status).toBe(200);

    const { data: log } = await admin()
      .from("audit_log")
      .select("action, target")
      .eq("action", "setting.update")
      .eq("target", "setting:practice.disabled")
      .limit(1);
    expect(log?.length).toBe(1);

    expect((await put([])).status).toBe(200);
    expect((await g.api("/api/v1/guided/dusk")).status).toBe(200);
  });
});
