import "server-only";
import { connection } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_SWITCH, gameState, openGame, type GameMeta, type GameSwitch } from "@/lib/catalog";
import { switchFromRows, type GameStateRow } from "@/lib/game-state";
import { checkAdmin } from "@/lib/admin/auth";
import { DEFAULTS, mergeSettings, type GameSettings } from "./schema";

let cache: { at: number; value: GameSettings } | null = null;
// 30 s in production; no cache in development and tests (SETTINGS_CACHE_MS overrides), so a change applies at once.
const TTL_MS = Number(process.env.SETTINGS_CACHE_MS ?? (process.env.NODE_ENV === "production" ? 30_000 : 0));

/**
 * Current game settings (stored values over defaults), cached for 30 s per server instance.
 *
 * Settings change at runtime, so whatever reads them must render per request: without `connection()` a page that
 * decides before touching cookies (e.g. a game switched Off's `notFound()`) can be rendered once and cached,
 * and then stays "not found" after an admin switches the game on, until the next deploy.
 */
export async function getGameSettings(): Promise<GameSettings> {
  try {
    await connection();
  } catch {
    /* outside a request (scripts, tests, cron helpers): nothing to opt out of */
  }
  return readSettings();
}

async function readSettings(): Promise<GameSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const [stored, games] = await Promise.all([readStored(), readGameSwitch()]);
  cache = { at: Date.now(), value: { ...stored, ...games } };
  return cache.value;
}

async function readStored(): Promise<GameSettings> {
  try {
    const { data, error } = await supabaseAdmin().from("game_settings").select("key, value");
    if (error) throw error;
    return mergeSettings(data ?? []);
  } catch {
    // Table missing (rolled back) or database hiccup: play continues on defaults.
    return { ...DEFAULTS };
  }
}

/**
 * The games' runtime switch (On, In testing, Off and the Duels and Parties opt-out) from `games.status` and
 * `games.versus`. Before migration 20261212010101 adds `versus`, reads the status alone. A database hiccup keeps the
 * last switch this instance read rather than opening every game: a game an admin switched off stays off.
 */
let lastSwitch: GameSwitch = DEFAULT_SWITCH;
async function readGameSwitch(): Promise<GameSwitch> {
  try {
    const db = supabaseAdmin();
    let res = await db.from("games").select("id, status, versus");
    if (res.error?.code === "42703") res = await db.from("games").select("id, status");
    if (res.error) throw res.error;
    lastSwitch = switchFromRows((res.data ?? []) as GameStateRow[]);
  } catch {
    /* keep the last switch */
  }
  return lastSwitch;
}

/**
 * True when this request comes from a signed-in admin (any role, second step done): the admin session cookie in a
 * browser, or an admin's Bearer token (API clients). Only games In testing ask, so players pay nothing for it.
 */
export async function isAdminViewer(): Promise<boolean> {
  try {
    return (await checkAdmin()).ok;
  } catch {
    return false;
  }
}

/**
 * The game when this request may open it now: On for everyone; In testing only for a signed-in admin. Unknown,
 * retired and Off ids, and In testing ones for players, are undefined (answer them 404, like an unknown game).
 */
export async function openGameNow(id: string | null | undefined): Promise<GameMeta | undefined> {
  const s = await getGameSettings();
  const st = gameState(id, s);
  if (st === "testing") return openGame(id, s, { admin: await isAdminViewer() });
  return openGame(id, s);
}

/**
 * The games' runtime switch, for the static public pages (game pages, games index, How to play, llms.txt, sitemap)
 * that are rebuilt hourly and at once after an admin changes a game's state (lib/seo/revalidate). Unlike
 * `getGameSettings` it does not make the page render per request. Public pages always show the player view.
 */
export async function servedGameSwitch(): Promise<GameSwitch> {
  const s = await readSettings();
  return { "games.testing": s["games.testing"], "games.off": s["games.off"], "games.noVersus": s["games.noVersus"] };
}

/** Drops the cache after an admin change so this instance serves the new value at once. */
export function invalidateGameSettings() {
  cache = null;
}
