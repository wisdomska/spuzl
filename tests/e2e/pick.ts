/** Pickers for the app's own controls (no Playwright selectOption: the app has no native <select> left). Re-exported by harness.ts. */
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Picks an option in the app's dropdown (components/ui/Select, Radix): opens the combobox named `label` and clicks
 * the option named `option` (exact, or a RegExp). Playwright's selectOption only works on a native <select>, which
 * the app no longer uses. `scope` may be a page or a locator (a form), to find the combobox inside it; the open list
 * is portalled to the page.
 */
export async function pickOption(scope: Page | Locator, label: string | RegExp, option: string | RegExp) {
  const page = "page" in scope && typeof scope.page === "function" ? scope.page() : (scope as Page);
  await scope.getByRole("combobox", { name: label }).click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  await list.getByRole("option", { name: option, exact: typeof option === "string" }).click();
  await expect(list).toBeHidden();
}

/** Taps a birth month (1 to 12) on the onboarding age step: twelve month buttons (radios), "January" to "December". */
export async function pickMonth(page: Page, month: number) {
  const radio = page.getByRole("radiogroup", { name: "Month" }).getByRole("radio", { name: MONTH_NAMES[month - 1], exact: true });
  await radio.check();
  return radio;
}
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
