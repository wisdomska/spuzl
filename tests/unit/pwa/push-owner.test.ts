// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimPushFor } from "@/lib/client/alerts";

/** Push follows the signed-in account (from Clink), saved only when the account (or the subscription) changes. */
describe("push follows the account in use", () => {
  let posts: string[];
  beforeEach(() => {
    localStorage.clear();
    posts = [];
    const sub = {
      endpoint: "https://push.example.test/device-1",
      toJSON: () => ({ endpoint: "https://push.example.test/device-1", keys: {} }),
    };
    Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "granted" } });
    Object.defineProperty(window, "PushManager", { configurable: true, value: function PushManager() {} });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => sub, subscribe: async () => sub } }) },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") posts.push(url);
        return new Response(JSON.stringify(init?.method === "POST" ? { on: true } : { publicKey: "BPk" }), { status: 200 });
      }),
    );
  });

  it("saves the device's subscription for the account signed in, once", async () => {
    expect(await claimPushFor("player-a")).toBe(true);
    expect(posts).toHaveLength(1);
    // the next page loads: nothing sent again
    expect(await claimPushFor("player-a")).toBe(true);
    expect(await claimPushFor("player-a")).toBe(true);
    expect(posts).toHaveLength(1);
  });

  it("moves it when another account signs in on the same phone", async () => {
    await claimPushFor("player-a");
    await claimPushFor("player-b");
    expect(posts).toHaveLength(2);
    await claimPushFor("player-b");
    expect(posts).toHaveLength(2);
  });

  it("does nothing without permission", async () => {
    Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "default" } });
    expect(await claimPushFor("player-a")).toBe(false);
    expect(posts).toHaveLength(0);
  });
});
