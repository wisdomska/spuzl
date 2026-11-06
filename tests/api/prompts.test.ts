import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@/lib/admin/dates";
import { admin, BASE, guest } from "./helpers";
import { adminSession, type AdminSession } from "./admin-helpers";

/**
 * R2-04 prompt timing, server side: prompt metrics are accepted only as known (prompt, trigger) pairs, aggregate
 * per trigger on the admin Metrics page with CSV, and the prompt settings are range-checked (including the set of
 * notification triggers). Run: API_BASE=http://localhost:3203 pnpm vitest run -c vitest.api.config.mts tests/api/prompts.test.ts
 */

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
let owner: AdminSession;
let analyst: AdminSession;
const metricIds: number[] = [];

beforeAll(async () => {
  owner = await adminSession("owner");
  analyst = await adminSession("analyst");
}, 120_000);

afterAll(async () => {
  if (metricIds.length) await admin().from("client_metrics").delete().in("id", metricIds);
  await admin().from("game_settings").delete().like("key", "prompts.%");
});

describe("prompt metrics (client)", () => {
  it("accepts known prompt and trigger pairs from guests and signed-out visitors, refuses the rest", async () => {
    const g = await guest();
    const send = (json: unknown) => g.api("/api/v1/metrics", { json });
    expect((await send({ name: "prompt_shown", mode: "alerts", kind: "friend" })).status).toBe(204);
    expect((await send({ name: "prompt_accepted", mode: "low_data", kind: "slow_loads" })).status).toBe(204);
    expect((await send({ name: "prompt_dismissed", mode: "save_streak", kind: "clears" })).status).toBe(204);
    const anon = await fetch(`${BASE}/api/v1/metrics`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "prompt_shown", mode: "event", kind: "live" }),
    });
    expect(anon.status).toBe(204);

    expect((await send({ name: "prompt_shown", mode: "alerts", kind: "slow_loads" })).status).toBe(400);
    expect((await send({ name: "prompt_shown", mode: "popup", kind: "friend" })).status).toBe(400);
    expect((await send({ name: "prompt_shown" })).status).toBe(400);

    const { data } = await admin()
      .from("client_metrics")
      .select("id, name, mode, kind")
      .like("name", "prompt_%")
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    expect(data?.length).toBeGreaterThanOrEqual(4);
    metricIds.push(...(data ?? []).map((r) => r.id));
  });
});

describe("prompt acceptance by trigger (admin Metrics)", () => {
  // A random week years back, so the seeded rows are the only prompt rows in it.
  const end = day(-(4_000 + Math.floor(Math.random() * 5_000)));
  const on = addDays(end, -1);
  const at = `${on}T12:00:00Z`;

  beforeAll(async () => {
    const row = (name: string, mode: string, kind: string) => ({ name, mode, kind, created_at: at });
    const { data, error } = await admin()
      .from("client_metrics")
      .insert([
        row("prompt_shown", "alerts", "friend"),
        row("prompt_shown", "alerts", "friend"),
        row("prompt_accepted", "alerts", "friend"),
        row("prompt_dismissed", "alerts", "friend"),
        row("prompt_shown", "low_data", "slow_net"),
        row("prompt_dismissed", "low_data", "slow_net"),
      ])
      .select("id");
    expect(error).toBeNull();
    metricIds.push(...data!.map((r) => r.id));
  });

  it("counts shown, accepted and dismissed per trigger, per day and for the range", async () => {
    const r = await analyst.aal2(`/api/admin/metrics?days=7&end=${end}`);
    expect(r.status).toBe(200);
    expect(r.data.total).toMatchObject({ prompt_shown: 3, prompt_accepted: 1, prompt_dismissed: 2 });
    expect(r.data.total.prompts["alerts.friend"]).toEqual({ shown: 2, accepted: 1, dismissed: 1 });
    expect(r.data.total.prompts["low_data.slow_net"]).toEqual({ shown: 1, accepted: 0, dismissed: 1 });
    const d = r.data.rows.find((x: { date: string }) => x.date === on);
    expect(d.prompts["alerts.friend"].shown).toBe(2);
    expect(r.data.rows.find((x: { date: string }) => x.date === end)).toMatchObject({ prompt_shown: 0, prompts: {} });
    // the older parts of the page are still there
    expect(r.data.total).toHaveProperty("tap_n");
    expect(r.data.total).toHaveProperty("hint_requests");
  });

  it("exports the per-trigger CSV, audited", async () => {
    const x = await analyst.aal2("/api/admin/metrics", { json: { metric: "prompts", days: 7, end } });
    expect(x.status).toBe(200);
    const lines: string[] = x.data.csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe("date,prompt,trigger,shown,accepted,dismissed,accept_pct");
    expect(lines).toContain(`${on},alerts,friend,2,1,1,50`);
    expect(lines).toContain("total,alerts,friend,2,1,1,50");
    expect(lines).toContain("total,low_data,slow_net,1,0,1,0");
    expect(x.data.filename).toBe(`spuzl-prompts-${addDays(end, -6)}-to-${end}.csv`);
  });
});

describe("prompt settings (admin cascade)", () => {
  it("range-checks the numbers and the trigger set; the public endpoint serves them", async () => {
    const put = (key: string, value: unknown) => owner.aal2("/api/admin/settings", { method: "PUT", json: { key, value } });
    expect((await put("prompts.alertsCooldownDays", 31)).status).toBe(422);
    expect((await put("prompts.lowDataThresholdMs", 1000)).status).toBe(422);
    expect((await put("prompts.alertsTriggers", ["friend", "birthday"])).status).toBe(422);
    expect((await put("prompts.alertsTriggers", "friend")).status).toBe(422);
    expect((await put("prompts.alertsTriggers", ["invite", "streak"])).status).toBe(200);
    expect((await put("prompts.lowDataSlowLoads", 3)).status).toBe(200);

    const list = await owner.aal2("/api/admin/settings");
    const row = list.data.rows.find((r: { key: string }) => r.key === "prompts.alertsTriggers");
    expect(row).toMatchObject({ value: ["invite", "streak"], isDefault: false, def: { kind: "set" } });

    const pub = await fetch(`${BASE}/api/v1/settings/game`).then((r) => r.json());
    expect(pub["prompts.alertsTriggers"]).toEqual(["invite", "streak"]);
    expect(pub["prompts.lowDataSlowLoads"]).toBe(3);
    expect(pub["prompts.alertsCooldownDays"]).toBe(7);

    expect((await analyst.aal2("/api/admin/settings", { method: "PUT", json: { key: "prompts.lowDataSlowLoads", value: 2 } })).status).toBe(
      403,
    );
    const { data: log } = await admin()
      .from("audit_log")
      .select("action, target")
      .eq("action", "setting.update")
      .eq("target", "setting:prompts.alertsTriggers")
      .limit(1);
    expect(log?.length).toBe(1);
  });
});
