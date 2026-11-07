import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin } from "../api/helpers";
import { onboardGuest, VIEWPORTS } from "./harness";

/**
 * R2-P5 school leagues on the Leagues tab: an 18+ player finds a seeded school by name and joins it; a 15-year-old
 * is pointed to the teacher's class code and gets no search. The switch "features.schoolLeagues" is turned on for
 * the run and put back after; the seeded school is removed. Needs the dev server and a database. The lead runs it.
 */
test.describe.configure({ mode: "serial" });

const KEY = "features.schoolLeagues";
let before: unknown;
const name = `QA Campus ${Date.now() % 1e6}`;
let schoolId = "";

test.beforeAll(async () => {
  before = (await admin().from("game_settings").select("value").eq("key", KEY).maybeSingle()).data?.value;
  await admin().from("game_settings").upsert({ key: KEY, value: true }, { onConflict: "key" });
  const { data, error } = await admin()
    .from("schools")
    .insert({ name, city: "Kumasi", country: "Ghana", kind: "campus", code: `Q${Date.now() % 1e5}`, verified_by: randomUUID() })
    .select("id")
    .single();
  if (error) throw error;
  schoolId = data.id;
});

test.afterAll(async () => {
  if (before === undefined) await admin().from("game_settings").delete().eq("key", KEY);
  else await admin().from("game_settings").upsert({ key: KEY, value: before }, { onConflict: "key" });
  await admin().from("players").update({ school_id: null }).eq("school_id", schoolId);
  await admin().from("schools").delete().eq("id", schoolId);
});

for (const [label, vp] of [
  ["375", VIEWPORTS.phone],
  ["1280", VIEWPORTS.desktop],
] as const) {
  test(`an adult finds and joins their campus (${label})`, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    await onboardGuest(page);
    await page.goto("/leagues");
    const card = page.getByTestId("school-league");
    await expect(card.getByRole("heading", { name: "School league" })).toBeVisible({ timeout: 15_000 });
    await card.getByRole("searchbox", { name: "School or campus name" }).fill(name.slice(0, 9));
    await card.getByRole("button", { name: `Join ${name}` }).click();
    await expect(card.getByText(`You play for ${name}`)).toBeVisible();
    await page.screenshot({ path: `docs/qa/screens/r2/p5-school-league-${label}.png`, fullPage: true });
  });

  test(`a 15-year-old gets the class code route, never a search (${label})`, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    await onboardGuest(page, "13-15");
    await page.goto("/leagues");
    const card = page.getByTestId("school-league");
    await expect(card.getByText("Join your school with your teacher's class code.")).toBeVisible({ timeout: 15_000 });
    await expect(card.getByRole("searchbox")).toHaveCount(0);
    await expect(card.getByRole("link", { name: "Enter a class code" })).toHaveAttribute("href", "/school-cup");
    await page.screenshot({ path: `docs/qa/screens/r2/p5-school-league-under16-${label}.png`, fullPage: true });
  });
}
