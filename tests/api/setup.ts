import { beforeAll } from "vitest";
import { admin } from "./helpers";

/**
 * The product runs with Dailies off (admin setting "features.dailies"). The API suite covers the Daily code
 * paths too, so it switches them on; the "Dailies off" test switches them off and back on itself.
 * Needs the server to read settings without a cache (development, or SETTINGS_CACHE_MS=0).
 */
export async function setSetting(key: string, value: unknown) {
  const { error } = await admin().from("game_settings").upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

beforeAll(async () => {
  await setSetting("features.dailies", true);
});
