import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetForTests, enqueueFinish, finishOrQueue, flush, listQueued, onSynced } from "./queue";

type Call = { url: string; body: Record<string, unknown> };

function mockFetch(responder: (url: string, body: Record<string, unknown>) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ url, body });
      return responder(url, body);
    }),
  );
  return calls;
}

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const payload = { state: [0, 2, 0, 0], activeMs: 41_000, mistakes: 1 };

function setOnline(v: boolean) {
  Object.defineProperty(globalThis.navigator, "onLine", { value: v, configurable: true });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetForTests();
  setOnline(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("offline queue", () => {
  it("stores one finish per attempt with the device's finishedAt", async () => {
    const at = new Date("2026-10-31T09:15:00Z");
    await enqueueFinish("a1", payload, at);
    await enqueueFinish("a1", { ...payload, mistakes: 2 }, at); // replaces, never duplicates
    await enqueueFinish("a2", payload, new Date("2026-10-31T08:00:00Z"));
    const q = await listQueued();
    expect(q.map((i) => i.attemptId)).toEqual(["a2", "a1"]); // oldest clear first
    expect(q[1]).toMatchObject({ finishedAt: at.toISOString(), tries: 0, payload: { mistakes: 2 } });
    expect(typeof q[1].payload.localHour).toBe("number");
  });

  it("flush posts offline: true with finishedAt to the existing finish endpoint, then empties", async () => {
    const calls = mockFetch(() => json(200, { ok: true, status: "cleared", timeMs: 41_000 }));
    const seen: string[] = [];
    onSynced((s) => seen.push(s.attemptId));
    await enqueueFinish("abc", payload, new Date("2026-10-31T10:00:00Z"));
    const r = await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/v1/attempts/abc/finish");
    expect(calls[0].body).toMatchObject({ ...payload, offline: true, finishedAt: "2026-10-31T10:00:00.000Z" });
    expect(r.synced).toEqual([{ attemptId: "abc", status: 200, result: { ok: true, status: "cleared", timeMs: 41_000 } }]);
    expect(r.remaining).toBe(0);
    expect(seen).toEqual(["abc"]);
    expect(await listQueued()).toEqual([]);
  });

  it("keeps entries on network errors, 5xx, 429 and 401, counting tries", async () => {
    let n = 0;
    mockFetch(() => {
      n++;
      if (n === 1) throw new TypeError("Failed to fetch");
      if (n === 2) return json(503, { error: "backend_offline" });
      if (n === 3) return json(429, { error: "rate_limited" });
      return json(401, { error: "unauthenticated" });
    });
    await enqueueFinish("x", payload);
    for (let i = 0; i < 4; i++) expect((await flush()).remaining).toBe(1);
    const [item] = await listQueued();
    expect(item.tries).toBe(4);
    expect(item.lastError).toBe("http_401");
  });

  it("drops entries the server settles for good", async () => {
    mockFetch((url) => {
      if (url.includes("/closed/")) return json(409, { error: "attempt_closed" });
      return json(404, { error: "attempt_not_found" });
    });
    await enqueueFinish("closed", payload);
    await enqueueFinish("gone", payload);
    const r = await flush();
    expect(r.synced.map((s) => s.attemptId)).toEqual(["closed"]);
    expect(r.rejected).toEqual([{ attemptId: "gone", status: 404, error: "attempt_not_found" }]);
    expect(await listQueued()).toEqual([]);
  });

  it("does nothing while offline", async () => {
    const calls = mockFetch(() => json(200, {}));
    await enqueueFinish("o", payload);
    setOnline(false);
    expect((await flush()).remaining).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it("shares one run between concurrent flushes", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls = mockFetch(async () => {
      await gate;
      return json(200, { ok: true });
    });
    await enqueueFinish("c", payload);
    const a = flush();
    const b = flush();
    expect(a).toBe(b);
    release();
    await a;
    expect(calls).toHaveLength(1);
  });

  it("finishOrQueue finishes online and queues offline or on network failure", async () => {
    mockFetch(() => json(200, { ok: true, status: "cleared" }));
    expect(await finishOrQueue("on", payload)).toEqual({ queued: false, result: { ok: true, status: "cleared" } });

    setOnline(false);
    const off = await finishOrQueue("off", payload);
    expect(off.queued).toBe(true);

    setOnline(true);
    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    expect((await finishOrQueue("drop", payload)).queued).toBe(true);
    expect((await listQueued()).map((i) => i.attemptId).sort()).toEqual(["drop", "off"]);
  });

  it("finishOrQueue surfaces server errors instead of queueing them", async () => {
    mockFetch(() => json(409, { error: "attempt_closed", message: "attempt_closed" }));
    await expect(finishOrQueue("z", payload)).rejects.toMatchObject({ status: 409, code: "attempt_closed" });
    expect(await listQueued()).toEqual([]);
  });
});
