/**
 * k6 load test (SRS NFR: 500 concurrent players, 50 Party rooms). Run against a LOCAL stack only:
 *
 *   node tests/load/mint-players.mjs 500 http://localhost:3400 > /tmp/tokens.json
 *   k6 run -e BASE=http://localhost:3400 -e TOKENS=/tmp/tokens.json -e SOLUTION='[7,4,2,0,3,1,6,8,5]' tests/load/daily-and-rooms.js
 *
 * SOLUTION is today's Crownfall solution (column per row); without it the Daily finish is skipped.
 * Players 0..299 play the Daily loop; players 300..499 fill 50 four-player Party rooms.
 */
import http from "k6/http";
import exec from "k6/execution";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE = __ENV.BASE || "http://localhost:3400";
const TOKENS = JSON.parse(open(__ENV.TOKENS || "./tokens.json"));
const SOLUTION = __ENV.SOLUTION ? JSON.parse(__ENV.SOLUTION) : null;
const DAILY_PLAYERS = Number(__ENV.DP || 300);
const ROOM_BASE = Number(__ENV.ROOM_BASE || DAILY_PLAYERS);
const ROOMS = Number(__ENV.ROOMS || 50);

const finishTime = new Trend("finish_ms", true);
const roomStart = new Trend("room_start_ms", true);

export const options = {
  scenarios: {
    daily: { executor: "per-vu-iterations", vus: DAILY_PLAYERS, iterations: 1, maxDuration: "6m", exec: "daily", startTime: "0s" },
    rooms: { executor: "per-vu-iterations", vus: ROOMS, iterations: 1, maxDuration: "6m", exec: "rooms", startTime: "10s" },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:read}": ["p(95)<800"],
    "http_req_duration{kind:write}": ["p(95)<1500"],
    checks: ["rate>0.99"],
  },
};

const h = (i) => ({ headers: { authorization: `Bearer ${TOKENS[i]}`, "content-type": "application/json" } });
const get = (i, path) =>
  http.get(BASE + path, { ...h(i), tags: { kind: "read", name: path.replace(/[0-9a-f-]{36}|\b[A-Z0-9]{4}\b/g, ":id") } });
const post = (i, path, body, method = "POST", expected) =>
  http.request(method, BASE + path, JSON.stringify(body ?? {}), {
    ...h(i),
    tags: { kind: "write", name: path.replace(/[0-9a-f-]{36}|\b[A-Z0-9]{4}\b/g, ":id") },
    ...(expected ? { responseCallback: http.expectedStatuses(...expected) } : {}),
  });

/** One player: open Home, play today's Crownfall Daily to a clear, then browse and practise. */
export function daily() {
  const i = exec.scenario.iterationInTest; // 0..299, unique per player
  sleep(Math.random() * 30); // arrivals spread over half a minute
  check(get(i, "/api/v1/me"), { "me 200": (r) => r.status === 200 });
  check(get(i, "/api/v1/today"), { "today 200": (r) => r.status === 200 });

  const start = post(i, "/api/v1/attempts", { game: "crownfall", mode: "daily" });
  if (check(start, { "daily start 200": (r) => r.status === 200 })) {
    const a = start.json();
    const n = a.puzzle.size;
    sleep(4 + Math.random() * 2);
    check(post(i, `/api/v1/attempts/${a.attemptId}`, { state: new Array(n * n).fill(0), activeMs: 3000 }, "PATCH"), {
      "save 200": (r) => r.status === 200,
    });
    if (SOLUTION) {
      sleep(3);
      const state = new Array(n * n).fill(0);
      SOLUTION.forEach((c, r) => (state[r * n + c] = 2));
      const t0 = Date.now();
      const fin = post(i, `/api/v1/attempts/${a.attemptId}/finish`, { state, activeMs: 6500, mistakes: 0 });
      finishTime.add(Date.now() - t0);
      check(fin, { "daily cleared": (r) => r.status === 200 && r.json("status") === "cleared" });
    }
  }

  for (let k = 0; k < 4; k++) {
    sleep(3 + Math.random() * 4);
    check(get(i, "/api/v1/leaderboards/crownfall?scope=global"), { "board 200": (r) => r.status === 200 });
    check(get(i, "/api/v1/quests"), { "quests 200": (r) => r.status === 200 });
    check(get(i, "/api/v1/leagues/current"), { "league 200": (r) => r.status === 200 });
    const free = post(i, "/api/v1/attempts", { game: k % 2 ? "sixer" : "crownfall", mode: "free" });
    check(free, { "free start 200": (r) => r.status === 200 });
  }
}

/** One Party room: host opens it, three friends join, everyone readies, the race runs to the end. */
export function rooms() {
  const room = exec.scenario.iterationInTest; // 0..49
  const ids = [0, 1, 2, 3].map((k) => ROOM_BASE + room * 4 + k);
  sleep(Math.random() * 20);
  const made = post(ids[0], "/api/v1/rooms", { game: "crownfall", difficulty: "easy", maxPlayers: 4 });
  if (!check(made, { "room created": (r) => r.status === 200 })) return;
  const { code, matchId } = made.json();
  for (const p of ids.slice(1)) check(post(p, `/api/v1/rooms/${code}/join`), { joined: (r) => r.status === 200 });
  for (const p of ids) check(post(p, `/api/v1/rooms/${code}/ready`, { ready: true }), { ready: (r) => r.status === 200 });
  for (const p of ids) check(get(p, `/api/v1/rooms/${code}`), { "lobby 200": (r) => r.status === 200 });
  const t0 = Date.now();
  check(post(ids[0], `/api/v1/rooms/${code}/start`), { started: (r) => r.status === 200 });
  roomStart.add(Date.now() - t0);
  sleep(4.5); // 3-2-1 countdown (TIMING.countdownMs) plus slack
  const view = get(ids[0], `/api/v1/matches/${matchId}`);
  const size = view.status === 200 ? (view.json("puzzle.data.size") ?? 5) : 5;
  const empty = new Array(size * size).fill(0);
  for (let tick = 0; tick < 6; tick++) {
    for (const p of ids)
      check(post(p, `/api/v1/matches/${matchId}/progress`, { round: 1, state: empty, mistakes: 0 }), {
        "progress ok": (r) => r.status === 200,
      });
    sleep(2);
  }
  for (const p of ids)
    check(post(p, `/api/v1/matches/${matchId}/finish`, { round: 1, state: empty, mistakes: 0 }, "POST", [200, 409, 422]), {
      "finish answered": (r) => r.status === 200 || r.status === 409 || r.status === 422,
    });
  check(get(ids[0], `/api/v1/matches/${matchId}`), { "match 200": (r) => r.status === 200 });
}
