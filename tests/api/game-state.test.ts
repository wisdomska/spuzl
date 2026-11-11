import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE, admin, birthFor, guest, uniq } from "./helpers";
import { adminSession, type AdminSession } from "./admin-helpers";
import { setSetting } from "./setup";

/**
 * Game state (owner request, 11 Nov 2026) through the real API. An admin sets each game On, In testing or Off on the
 * Games page (PATCH /api/admin/games/state, owner only, audited). In testing: players are refused everywhere exactly
 * like an unknown game, a signed-in admin can play it. Off: everyone is refused. Back On: everyone plays. Also the
 * "Can be played in Duels and Parties" switch and the Daily Five re-pick. Replaces tests/api/lab-flag.test.ts (the
 * "features.labGames" setting moved into the state).
 * Needs a server reading settings without a cache (development, or SETTINGS_CACHE_MS=0).
 * Run: API_BASE=http://localhost:<port> pnpm vitest run -c vitest.api.config.mts tests/api/game-state.test.ts
 */
const GAME = "sixer"; // a time race game with Levels, Dailies and a practice round
const OTHER = "nine";
const WORDS = "five"; // a guess-transport game (answers checked by /api/games/<id>/guess)
let owner: AdminSession;
let editor: AdminSession;
let analyst: AdminSession;

const notFound = async (path: string) => {
  const r = await fetch(BASE + path, { redirect: "manual" });
  // Streamed pages (with a loading state) send 200 before notFound() runs; only a real not-found carries the 404 digest.
  const body = r.status === 404 ? "" : await r.text();
  return r.status === 404 || body.includes("NEXT_HTTP_ERROR_FALLBACK;404");
};

const setState = (id: string, state: "on" | "testing" | "off", who: AdminSession = owner) =>
  who.aal2("/api/admin/games/state", { method: "PATCH", json: { id, state } });

const restore = async () => {
  await admin().from("games").update({ status: "live", versus: true }).in("id", [GAME, OTHER, WORDS]);
};

/** Every way a player reaches a game, each answered like an unknown game when refused. */
async function refusedEverywhere(p: Awaited<ReturnType<typeof guest>>, id: string) {
  for (const mode of ["free", "tutorial", "daily", "level"] as const) {
    const r = await p.api("/api/v1/attempts", { json: { game: id, mode, difficulty: "easy" } });
    expect([id, mode, r.status, r.data?.error]).toEqual([id, mode, 404, "unknown_game"]);
  }
  expect([id, "guided", (await p.api(`/api/v1/guided/${id}`)).status]).toEqual([id, "guided", 404]);
  const guess = await p.api(`/api/games/${id}/guess`, { json: { ref: { game: id, t: "1.AAAA" }, guess: "x" } });
  expect([id, "guess", guess.data?.error]).toEqual([id, "guess", "unknown_game"]);
  expect((await p.api(`/api/v1/archive?game=${id}`)).data?.error).toBe("unknown_game");
  expect((await p.api(`/api/v1/leaderboards/${id}`)).data?.error).toBe("unknown_game");
  // Duels and Parties: never raced.
  expect((await p.api("/api/v1/duel/friend", { json: { game: id } })).status).toBe(400);
  expect((await p.api("/api/v1/rooms", { json: { game: id, difficulty: "easy", maxPlayers: 4 } })).status).toBe(400);
  // Pages: the play page, its public page, its link preview.
  for (const path of [`/play/${id}?mode=free`, `/games/${id}`]) expect([path, await notFound(path)]).toEqual([path, true]);
  expect((await fetch(`${BASE}/games/${id}/opengraph-image`)).status).toBe(404);
  // Lists: the public settings carry the state, the sitemap and llms.txt leave it out, the Today list too.
  const pub = await fetch(`${BASE}/api/v1/settings/game`).then((r) => r.json());
  expect([...pub["games.testing"], ...pub["games.off"]]).toContain(id);
  expect(await fetch(`${BASE}/sitemap.xml`).then((r) => r.text())).not.toContain(`/games/${id}<`);
  expect(await fetch(`${BASE}/llms.txt`).then((r) => r.text())).not.toContain(`/games/${id})`);
  const today = await p.api("/api/v1/today");
  expect((today.data.games as { id: string }[]).map((g) => g.id)).not.toContain(id);
}

/** The admin's own token, as a player (a profile on the admin account). */
const asPlayer = (s: AdminSession) => ({
  api: (path: string, init: RequestInit & { json?: unknown } = {}) => s.aal2(path, init),
});

beforeAll(async () => {
  [owner, editor, analyst] = await Promise.all([adminSession("owner"), adminSession("content_editor"), adminSession("analyst")]);
  const prof = await owner.aal2("/api/v1/profile", { json: { nickname: uniq("own_"), ...birthFor("18+"), color: "#2FD3E0" } });
  expect(prof.status, JSON.stringify(prof.data)).toBe(200);
  await setSetting("features.dailies", true);
  await restore();
}, 60_000);
afterAll(restore);

describe("api: game state from the Games page", () => {
  it("is the owner's: other roles, unknown and retired games and unknown states are refused", async () => {
    expect((await setState(GAME, "off", editor)).status).toBe(403);
    expect((await setState(GAME, "off", analyst)).status).toBe(403);
    expect((await owner.aal1("/api/admin/games/state", { method: "PATCH", json: { id: GAME, state: "off" } })).status).toBe(403);
    expect((await setState("nope", "off")).status).toBe(404);
    expect((await setState("blackout", "on")).status).toBe(409);
    const bad = await owner.aal2("/api/admin/games/state", { method: "PATCH", json: { id: GAME, state: "paused" } });
    expect(bad.status).toBe(400);
    const nothing = await owner.aal2("/api/admin/games/state", { method: "PATCH", json: { id: GAME } });
    expect(nothing.status).toBe(400);
    const notRace = await owner.aal2("/api/admin/games/state", { method: "PATCH", json: { id: "chess", versus: false } });
    expect(notRace.status).toBe(422);
    const { data: row } = await admin().from("games").select("status").eq("id", GAME).single();
    expect(row?.status).toBe("live");
  });

  it("In testing: players are refused like an unknown game everywhere; a signed-in admin can play it", { timeout: 120_000 }, async () => {
    const set = await setState(GAME, "testing");
    expect([set.status, set.data.state]).toEqual([200, "testing"]);
    const { data: row } = await admin().from("games").select("status").eq("id", GAME).single();
    expect(row?.status).toBe("testing");
    const { data: log } = await admin()
      .from("audit_log")
      .select("action, detail")
      .eq("actor_id", owner.userId)
      .eq("action", "game_state.update")
      .eq("target", `game:${GAME}`)
      .order("id", { ascending: false })
      .limit(1);
    expect(log?.[0]?.detail).toMatchObject({ state: { before: "on", after: "testing" } });
    // The Games page shows it.
    const page = await editor.aal2("/api/admin/games/meta");
    expect(page.data.rows.find((r: { id: string }) => r.id === GAME)).toMatchObject({ state: "testing", retired: false });

    const p = await guest(uniq("gst_"));
    await refusedEverywhere(p, GAME);
    // Another game is untouched.
    expect((await p.api("/api/v1/attempts", { json: { game: OTHER, mode: "free", difficulty: "easy" } })).status).toBe(200);

    // The owner, signed in to the admin, tries it out.
    const me = asPlayer(owner);
    const free = await me.api("/api/v1/attempts", { json: { game: GAME, mode: "free", difficulty: "easy" } });
    expect(free.status, JSON.stringify(free.data)).toBe(200);
    expect((await me.api(`/api/v1/guided/${GAME}`)).status).toBe(200);
    // ...but never in a Duel or a Party (those are for games players can see).
    expect((await me.api("/api/v1/duel/friend", { json: { game: GAME } })).status).toBe(400);

    // The guess route of a word game In testing: unknown for players, read normally for the admin (a forged token is
    // a bad ref, not an unknown game).
    expect((await setState(WORDS, "testing")).status).toBe(200);
    const forged = { ref: { game: WORDS, t: "1.AAAA" }, guess: "CRANE" };
    expect((await p.api(`/api/games/${WORDS}/guess`, { json: forged })).data?.error).toBe("unknown_game");
    expect((await me.api(`/api/games/${WORDS}/guess`, { json: forged })).data?.error).not.toBe("unknown_game");
    expect((await setState(WORDS, "on")).status).toBe(200);
    expect((await p.api(`/api/games/${WORDS}/guess`, { json: forged })).data?.error).not.toBe("unknown_game");
  });

  it("Off: refused for everyone, the team included", { timeout: 120_000 }, async () => {
    expect((await setState(GAME, "off")).status).toBe(200);
    const p = await guest(uniq("gsf_"));
    await refusedEverywhere(p, GAME);
    const me = asPlayer(owner);
    const r = await me.api("/api/v1/attempts", { json: { game: GAME, mode: "free", difficulty: "easy" } });
    expect([r.status, r.data?.error]).toEqual([404, "unknown_game"]);
    expect((await me.api(`/api/v1/guided/${GAME}`)).status).toBe(404);
  });

  it("an attempt opened before the switch can't be finished or hinted after it", async () => {
    await setState(GAME, "on");
    const p = await guest(uniq("gsa_"));
    const start = await p.api("/api/v1/attempts", { json: { game: GAME, mode: "free", difficulty: "easy" } });
    expect(start.status).toBe(200);
    await setState(GAME, "off");
    const hint = await p.api(`/api/v1/attempts/${start.data.attemptId}/hint`, { json: { state: null } });
    expect([hint.status, hint.data?.error]).toEqual([404, "unknown_game"]);
    const fin = await p.api(`/api/v1/attempts/${start.data.attemptId}/finish`, { json: { state: null, activeMs: 60_000, mistakes: 0 } });
    expect([fin.status, fin.data?.error]).toEqual([404, "unknown_game"]);
  });

  it("back On: everyone plays it again, and it is listed again", async () => {
    expect((await setState(GAME, "on")).status).toBe(200);
    const p = await guest(uniq("gso_"));
    expect((await p.api("/api/v1/attempts", { json: { game: GAME, mode: "free", difficulty: "easy" } })).status).toBe(200);
    expect((await p.api(`/api/v1/guided/${GAME}`)).status).toBe(200);
    expect((await p.api("/api/v1/duel/friend", { json: { game: GAME } })).status).toBe(200);
    expect(await notFound(`/play/${GAME}?mode=free`)).toBe(false);
    const pub = await fetch(`${BASE}/api/v1/settings/game`).then((r) => r.json());
    expect([...pub["games.testing"], ...pub["games.off"]]).not.toContain(GAME);
  });

  it("Duels and Parties switch: kept out of the pickers and rooms, still playable alone", async () => {
    const off = await owner.aal2("/api/admin/games/state", { method: "PATCH", json: { id: GAME, versus: false } });
    expect([off.status, off.data.versus]).toEqual([200, false]);
    try {
      const pub = await fetch(`${BASE}/api/v1/settings/game`).then((r) => r.json());
      expect(pub["games.noVersus"]).toContain(GAME);
      const p = await guest(uniq("gsv_"));
      expect((await p.api("/api/v1/duel/friend", { json: { game: GAME } })).data?.error).toBe("game_not_duelable");
      expect((await p.api("/api/v1/duel/queue", { json: { game: GAME, rulesSeen: true } })).data?.error).toBe("game_not_duelable");
      expect((await p.api("/api/v1/rooms", { json: { game: GAME, difficulty: "easy", maxPlayers: 4 } })).status).toBe(400);
      expect((await p.api("/api/v1/rooms", { json: { games: [GAME, OTHER], difficulty: "easy", maxPlayers: 4 } })).status).toBe(400);
      expect((await p.api("/api/v1/attempts", { json: { game: GAME, mode: "free", difficulty: "easy" } })).status).toBe(200);
    } finally {
      await owner.aal2("/api/admin/games/state", { method: "PATCH", json: { id: GAME, versus: true } });
    }
  });

  it("re-picks today's and upcoming unlocked Daily Five days that hold a game taken from players", { timeout: 120_000 }, async () => {
    await setSetting("dailyFive.enabled", true);
    const p = await guest(uniq("gs5_"));
    const five = (await p.api("/api/v1/daily-five")).data as { date: string; games: { game: string }[] };
    const { data: locked } = await admin().from("daily_five").select("locked").eq("date", five.date);
    if ((locked ?? []).some((r) => r.locked)) return; // a locked day keeps its games on purpose
    const id = five.games[0].game;
    try {
      const r = await setState(id, "off");
      expect(r.status).toBe(200);
      expect(r.data.dailyFive?.days?.length ?? 0).toBeGreaterThan(0);
      const { data: rows } = await admin().from("daily_five").select("game_id").eq("date", five.date);
      expect((rows ?? []).map((x) => x.game_id)).not.toContain(id);
      const { data: log } = await admin()
        .from("audit_log")
        .select("detail")
        .eq("action", "daily_five.lab_repick")
        .eq("actor_id", owner.userId)
        .order("id", { ascending: false })
        .limit(1);
      expect(log?.[0]?.detail).toMatchObject({ off: [id] });
    } finally {
      await setState(id, "on");
    }
  });
});
