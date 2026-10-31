import { test } from "@playwright/test";
import { player } from "./helpers";

/** Visual review captures (not assertions): SHOTS=1 pnpm playwright test -c tests/realtime/playwright.config.ts shots */
test.skip(!process.env.SHOTS, "visual captures run on demand");

const OUT = process.env.SHOTS_DIR ?? "test-results/shots";

test("capture multiplayer screens", async ({ browser }) => {
  for (const theme of ["dark", "light"] as const) {
    const p = await player(browser, "shot_");
    await p.context.addInitScript((t) => localStorage.setItem("spuzl.settings", JSON.stringify({ theme: t })), theme);
    for (const [name, path] of [
      ["duel-entry", "/duel"],
      ["party-create", "/party"],
      ["bay-inbox", "/bay"],
    ] as const) {
      await p.page.goto(path);
      await p.page.waitForTimeout(2500);
      await p.page.screenshot({ path: `${OUT}/${name}-${theme}.png` });
    }
    await p.context.close();
  }
});
