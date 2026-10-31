import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

/**
 * Offline clear sync (SRS 17 E2E: "offline clear sync"): load the fixture online, lose the
 * connection, clear the puzzle, come back online and see the queued clear land on the server.
 */
const env = Object.fromEntries(
  fs.existsSync(".env.local")
    ? fs
        .readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
    : [],
);
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

test("a clear made offline is queued and syncs when back online", async ({ page, context }) => {
  await page.goto("/dev/pwa");
  await page.getByTestId("setup").click();
  await expect(page.getByTestId("log")).toContainText("Ready", { timeout: 20_000 });
  const attemptPrefix = ((await page.getByTestId("log").innerText()).match(/Ready (\w{8})/) ?? [])[1];

  await context.setOffline(true);
  await expect(page.getByTestId("offline-banner").first()).toHaveText("Offline. Keep solving, we'll sync your time.");

  await page.getByTestId("clear").click();
  await expect(page.getByTestId("log")).toContainText("Saved on this device");
  await expect(page.getByTestId("pending")).toHaveText("Waiting to sync: 1");

  await context.setOffline(false);
  await expect(page.getByTestId("log")).toContainText(/Synced \w{8}: cleared/, { timeout: 20_000 });
  await expect(page.getByTestId("pending")).toHaveText("Waiting to sync: 0");
  await expect(page.getByTestId("offline-banner").first()).toHaveText("Times synced.");

  // The server recorded it as an offline clear.
  if (SB_URL && SERVICE && attemptPrefix) {
    const db = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
    const { data } = await db
      .from("attempts")
      .select("id, status, offline, finished_at")
      .eq("mode", "tutorial")
      .eq("offline", true)
      .order("finished_at", { ascending: false })
      .limit(20);
    const row = (data ?? []).find((r) => r.id.startsWith(attemptPrefix));
    expect(row).toMatchObject({ status: "cleared", offline: true });
  }
});
