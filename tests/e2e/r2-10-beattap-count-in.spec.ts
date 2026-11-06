import { expect, test, type Page } from "@playwright/test";
import { keepFocus, seededBoardUrl, VIEWPORTS } from "./harness";
import { createRng } from "@/lib/rng";
import { COUNT_IN, countIn, generate, POINTS, STRAY_PENALTY } from "@/games/beattap/logic";

/**
 * R2-10 Beat Tap: a 4-click count-in before scoring (seen on the pad, heard as count sounds), the Start tap and
 * taps along with the count never off beat, practice never deducts, and the first-play "Turn sound on for this
 * one?" card. Runs on the seeded /dev/board fixture (ENABLE_DEV_ROUTES=1); `mode=tutorial` is the practice round.
 *   PW_BASE_URL=http://localhost:3400 pnpm exec playwright test tests/e2e/r2-10-beattap-count-in.spec.ts
 */

const SEED = "qa";
const { puzzle } = generate(createRng(SEED), "easy");
const shots = "docs/qa/screens/r2";

/** Records every `spuzl:fx` sound with its time, so the count-in and beats can be checked and tapped against. */
async function recordFx(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __fx: { sound: string; at: number }[] };
    w.__fx = [];
    window.addEventListener("spuzl:fx", (e) => w.__fx.push({ sound: (e as CustomEvent).detail.sound, at: performance.now() }));
  });
}

/** The sound card answered (or never shown): a device that has been asked. */
async function asked(page: Page) {
  await page.addInitScript(() => localStorage.setItem("spuzl.beattap.soundAsked", "1"));
}

async function open(page: Page, mode: "free" | "tutorial" = "free") {
  await page.goto(`${seededBoardUrl("beattap", SEED)}${mode === "tutorial" ? "&mode=tutorial" : ""}`);
  const pad = page.getByRole("button", { name: /^Beat pad\./ });
  await expect(pad).toBeEnabled({ timeout: 30_000 });
  return pad;
}

/**
 * Dispatches pad presses at these offsets (ms) after the first beat tick, in page so the timing does not ride the
 * CDP round trip. Returns the page text just after the last press (the feedback line before the next beat moves it on).
 */
async function pressAfterFirstBeat(page: Page, offsets: number[]) {
  return page.evaluate(async (offs) => {
    const w = window as unknown as { __fx: { sound: string; at: number }[] };
    const first = await new Promise<number>((done) => {
      const look = () => {
        const tick = w.__fx.find((f) => f.sound === "tick");
        if (tick) done(tick.at);
        else requestAnimationFrame(look);
      };
      look();
    });
    const pad = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label")?.startsWith("Beat pad."))!;
    for (const off of offs) {
      await new Promise((r) => setTimeout(r, Math.max(0, first + off - performance.now())));
      pad.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch" }));
    }
    await new Promise((r) => setTimeout(r, 60));
    return document.body.innerText;
  }, offsets);
}

const tally = async (page: Page, label: string) => {
  const name = await page
    .getByRole("list", { name: "Judgements" })
    .getByRole("listitem", { name: new RegExp(`^${label}: `) })
    .getAttribute("aria-label");
  return Number(name!.split(": ")[1]);
};

test.describe("R2-10 Beat Tap", () => {
  test.beforeEach(async ({ page }) => {
    await keepFocus(page);
    await recordFx(page);
  });

  test("count-in: four count clicks, seen and heard, before the first beat", async ({ page }) => {
    await asked(page);
    for (const vp of [VIEWPORTS.phone, VIEWPORTS.desktop]) {
      await page.setViewportSize(vp);
      const pad = await open(page);
      await page.evaluate(() => ((window as unknown as { __fx: unknown[] }).__fx.length = 0));
      await pad.click();
      // the pad counts 1 to 4 (status line and accessible name), a big number in the middle
      for (let n = 1; n <= COUNT_IN; n++) await expect(pad).toHaveAccessibleName(new RegExp(`Count in: ${n}`), { timeout: 3000 });
      await expect(pad.locator("[data-count]")).toBeVisible();
      await page.screenshot({ path: `${shots}/R2-10-count-in-${vp.width}.png` });
      await expect(pad).toHaveAccessibleName(/Beat 1 of \d+/, { timeout: 3000 });
      await page.waitForFunction(() => (window as unknown as { __fx: { sound: string }[] }).__fx.some((f) => f.sound === "tick"));
      const fx = await page.evaluate(() => (window as unknown as { __fx: { sound: string; at: number }[] }).__fx);
      const counts = fx.filter((f) => f.sound === "count");
      const firstTick = fx.find((f) => f.sound === "tick")!;
      expect(counts).toHaveLength(COUNT_IN);
      for (const c of counts) expect(c.at).toBeLessThan(firstTick.at);
      // the clicks keep the song's pulse
      const gap = countIn(puzzle.beats)[1] - countIn(puzzle.beats)[0];
      for (let i = 1; i < counts.length; i++) expect(Math.abs(counts[i].at - counts[i - 1].at - gap)).toBeLessThan(120);
    }
  });

  test("the Start tap and taps along with the count are never off beat", async ({ page }) => {
    await asked(page);
    const pad = await open(page);
    await pad.click();
    // tap along with the whole count
    for (let n = 1; n <= COUNT_IN; n++) {
      await expect(pad).toHaveAccessibleName(new RegExp(`Count in: ${n}`), { timeout: 3000 });
      await pad.click();
    }
    await expect(pad).toHaveAccessibleName(/Beat 1 of \d+/, { timeout: 3000 });
    expect(await tally(page, "Off beat")).toBe(0);
    await expect(page.getByText(/No beat there/)).toHaveCount(0);
  });

  test("practice never deducts; a real round does", async ({ page }) => {
    await asked(page);
    test.setTimeout(90_000);
    const gap = puzzle.beats[1] - puzzle.beats[0];
    for (const mode of ["tutorial", "free"] as const) {
      const pad = await open(page, mode);
      await page.evaluate(() => ((window as unknown as { __fx: unknown[] }).__fx.length = 0));
      await pad.click();
      // hit the first beat, then tap halfway to the next (no beat there)
      const text = await pressAfterFirstBeat(page, [0, Math.round(gap / 2)]);
      expect(text).toContain(
        mode === "tutorial" ? "No beat there. Practice, so no points lost." : `No beat there. Minus ${STRAY_PENALTY}.`,
      );
      // let the song play out
      await expect(pad).toHaveAccessibleName(/Score \d+/, { timeout: 30_000 });
      const perfect = await tally(page, "Perfect");
      const good = await tally(page, "Good");
      const strays = await tally(page, "Off beat");
      expect(strays).toBeGreaterThanOrEqual(1);
      const score = Number((await pad.getAttribute("aria-label"))!.match(/Score (\d+)/)![1]);
      const raw = perfect * POINTS.perfect + good * POINTS.good;
      expect(score).toBe(mode === "tutorial" ? raw : Math.max(0, raw - strays * STRAY_PENALTY));
      if (mode === "tutorial") expect(perfect + good).toBeGreaterThanOrEqual(1);
    }
  });

  test("first play with sound off: Turn sound on for this one?", async ({ page }) => {
    await page.addInitScript(() => {
      // sound effects off (current audio defaults version, so the defaults do not turn it back on)
      if (!sessionStorage.getItem("r2-10-seeded")) {
        sessionStorage.setItem("r2-10-seeded", "1");
        localStorage.setItem("spuzl.audio", JSON.stringify({ sfx: false, music: false, audioVersion: 2 }));
      }
    });
    for (const vp of [VIEWPORTS.phone, VIEWPORTS.desktop]) {
      await page.setViewportSize(vp);
      await open(page);
      const card = page.locator("[data-sound-ask]");
      await expect(card.getByRole("heading", { name: "Turn sound on for this one?" })).toBeVisible();
      await page.screenshot({ path: `${shots}/R2-10-sound-ask-${vp.width}.png` });
      if (vp === VIEWPORTS.phone) {
        // a reload before answering asks again (not answered yet)
        continue;
      }
      await card.getByRole("button", { name: "Turn sound on" }).click();
      await expect(card).toHaveCount(0);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("spuzl.audio") ?? "{}").sfx)).toBe(true);
    }
    // asked once per device: never again
    await open(page);
    await expect(page.locator("[data-sound-ask]")).toHaveCount(0);
  });

  test("Not now keeps sound off and the card does not come back; starting the round also answers it", async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("r2-10-seeded")) {
        sessionStorage.setItem("r2-10-seeded", "1");
        localStorage.setItem("spuzl.audio", JSON.stringify({ sfx: false, music: false, audioVersion: 2 }));
      }
    });
    await open(page);
    const card = page.locator("[data-sound-ask]");
    await card.getByRole("button", { name: "Not now" }).click();
    await expect(card).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("spuzl.audio") ?? "{}").sfx)).toBe(false);
    await open(page);
    await expect(card).toHaveCount(0);
    // a fresh device that just taps Start: the card goes and is not asked again
    await page.evaluate(() => localStorage.removeItem("spuzl.beattap.soundAsked"));
    const pad = await open(page);
    await expect(card).toBeVisible();
    await pad.click();
    await expect(card).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("spuzl.beattap.soundAsked"))).toBe("1");
  });
});
