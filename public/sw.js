/* SPUZL service worker (hand-written; registered by lib/offline/register.ts).
 *
 * - App shell: navigations are network-first; the last good HTML for each page (and "/") is kept,
 *   so the app opens offline. With nothing cached, a small offline page explains what still works.
 * - Today's Dailies: POST /api/v1/attempts start responses for mode "daily" are cached per GMT day
 *   (one cache per day, older days are deleted) and replayed offline, so a prefetched Daily starts
 *   without a connection. A successful finish evicts that game's entry.
 * - Static assets (Next build output, fonts, /3d, /icons) are cache-first: their names are hashed or
 *   versioned. GET /api/v1/today and /api/v1/me fall back to their last good copy.
 * - Daily pack (SPZ-27b): where the browser fires Periodic Background Sync ("spuzl-daily-pack"),
 *   the worker starts and caches today's pack itself, once per GMT day, unless the page said low-data
 *   mode is on. Only ever today's: the server does not serve a Daily before its day (docs/qa/LOW_DATA.md).
 * - Never cached: other API writes, share images, Supabase and anything cross-origin.
 */
const VERSION = "2026-11-01.1";
const SHELL = `spuzl-shell-${VERSION}`;
const STATIC = `spuzl-static-${VERSION}`;
const DATA = `spuzl-data-${VERSION}`;
const DAILY_PREFIX = "spuzl-daily-";
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];
const DATA_PATHS = ["/api/v1/today", "/api/v1/me"];
const NAV_TIMEOUT_MS = 4000;

const todayGmt = () => new Date().toISOString().slice(0, 10);
const dailyCache = (day = todayGmt()) => `${DAILY_PREFIX}${day}`;
const dailyKey = (game) => `/__spuzl/daily/${encodeURIComponent(game)}`;
const PACK_TAG = "spuzl-daily-pack";
const PACK_CONFIG = "/__spuzl/daily-pack-config";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => Promise.all(SHELL_URLS.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, STATIC, DATA, dailyCache()]);
      for (const name of await caches.keys()) {
        if (name.startsWith("spuzl-") && !keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "clear-user-data") {
    // Sign-out: cached Dailies and /me belong to the previous player.
    event.waitUntil(
      (async () => {
        for (const name of await caches.keys()) if (name.startsWith(DAILY_PREFIX) || name === DATA) await caches.delete(name);
      })(),
    );
  }
  if (type === "daily-pack") {
    // The page's word on the background pack: which games, and whether low-data mode allows it.
    const games = Array.isArray(event.data.games) ? event.data.games.filter((g) => typeof g === "string").slice(0, 64) : [];
    event.waitUntil(
      (async () => {
        const cache = await caches.open(DATA);
        const prev = await readPackConfig();
        const cfg = { enabled: event.data.enabled === true, games, lastDay: prev ? prev.lastDay : null };
        await cache.put(PACK_CONFIG, new Response(JSON.stringify(cfg), { headers: { "content-type": "application/json" } }));
      })(),
    );
  }
});

async function readPackConfig() {
  const hit = await (await caches.open(DATA)).match(PACK_CONFIG);
  return hit ? hit.json().catch(() => null) : null;
}

/**
 * Background Daily pack: today's ready, uncleared launch Dailies, started and cached like the page's
 * own prefetch (lib/offline/register.ts prefetchDailies). Requests from the worker itself skip its
 * fetch handler, so the start responses are cached here.
 */
async function fetchDailyPack() {
  const cfg = await readPackConfig();
  const day = todayGmt();
  if (!cfg || !cfg.enabled || !cfg.games.length || cfg.lastDay === day) return;
  let today;
  try {
    const r = await fetch("/api/v1/today", { credentials: "same-origin" });
    if (!r.ok) return;
    await (await caches.open(DATA)).put("/api/v1/today", r.clone());
    today = await r.json();
  } catch {
    return;
  }
  if (!today || today.signedIn === false || !Array.isArray(today.games) || today.date !== day) return;
  const cache = await caches.open(dailyCache(day));
  for (const g of today.games) {
    if (!g.ready || g.state === "cleared" || !cfg.games.includes(g.id)) continue;
    try {
      const res = await fetch("/api/v1/attempts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game: g.id, mode: "daily" }),
      });
      if (res.status === 401 || res.status === 403) return; // signed out: try again another day
      if (res.ok) await cache.put(dailyKey(g.id), res);
    } catch {
      return; // connection dropped: the next sync tries again
    }
  }
  await pruneOldDays();
  const data = await caches.open(DATA);
  await data.put(PACK_CONFIG, new Response(JSON.stringify({ ...cfg, lastDay: day }), { headers: { "content-type": "application/json" } }));
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag === PACK_TAG) event.waitUntil(fetchDailyPack());
});

const offlinePage = () =>
  new Response(
    `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · SPUZL</title><meta name="theme-color" content="#0E0F1A"><style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0E0F1A;color:#F4F5FB;font:500 16px/1.5 system-ui,sans-serif;padding:24px;box-sizing:border-box;text-align:center}h1{font:900 24px system-ui,sans-serif;margin:16px 0 8px}p{color:#A2A6C2;margin:0 0 20px}a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:20px;background:#B8F23A;color:#0E0F1A;font-weight:800;text-decoration:none;box-shadow:0 6px 0 #6F9A1C}</style></head><body><main><img src="/icons/icon-192.png" width="96" height="96" alt=""><h1>You're offline.</h1><p>Dailies you opened today still work. Duels and Party need a connection.</p><a href="/">Try again</a></main></body></html>`,
    { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function navigation(event) {
  const req = event.request;
  const cache = await caches.open(SHELL);
  try {
    const res = await withTimeout(fetch(req), NAV_TIMEOUT_MS);
    if (res.ok && res.type === "basic" && !res.redirected) event.waitUntil(cache.put(req.url, res.clone()));
    return res;
  } catch {
    const url = new URL(req.url);
    return (
      (await cache.match(req.url, { ignoreSearch: false })) ||
      (await cache.match(url.origin + url.pathname, { ignoreSearch: true })) ||
      (await cache.match("/")) ||
      offlinePage()
    );
  }
}

async function cacheFirst(event, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (res.ok && res.type === "basic") event.waitUntil(cache.put(event.request, res.clone()));
  return res;
}

async function networkFirst(event, name) {
  const cache = await caches.open(name);
  try {
    const res = await fetch(event.request);
    if (res.ok) event.waitUntil(cache.put(event.request, res.clone()));
    return res;
  } catch {
    const hit = await cache.match(event.request);
    if (hit) return hit;
    return new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "content-type": "application/json" } });
  }
}

async function pruneOldDays() {
  const today = dailyCache();
  for (const name of await caches.keys()) if (name.startsWith(DAILY_PREFIX) && name !== today) await caches.delete(name);
}

async function startAttempt(event) {
  const req = event.request;
  let input = null;
  try {
    input = await req.clone().json();
  } catch {
    /* not JSON: let the server answer */
  }
  if (!input || input.mode !== "daily" || typeof input.game !== "string") return fetch(req);
  const cache = await caches.open(dailyCache());
  const key = dailyKey(input.game);
  try {
    const res = await fetch(req);
    if (res.ok) event.waitUntil(cache.put(key, res.clone()).then(pruneOldDays));
    else if (res.status === 409) event.waitUntil(cache.delete(key)); // already cleared today
    return res;
  } catch {
    const hit = await cache.match(key);
    if (!hit) {
      return new Response(JSON.stringify({ error: "offline", message: "This Daily isn't saved on this device yet." }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    const body = await hit.json();
    return new Response(JSON.stringify({ ...body, resumed: true, offline: true }), {
      status: 200,
      headers: { "content-type": "application/json", "x-spuzl-offline": "1" },
    });
  }
}

async function finishAttempt(event, attemptId) {
  const res = await fetch(event.request);
  if (res.ok || res.status === 409) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(dailyCache());
        for (const key of await cache.keys()) {
          const hit = await cache.match(key);
          const body = hit ? await hit.json().catch(() => null) : null;
          if (body && body.attemptId === attemptId) await cache.delete(key);
        }
      })(),
    );
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.method === "POST") {
    if (url.pathname === "/api/v1/attempts") return event.respondWith(startAttempt(event));
    const fin = url.pathname.match(/^\/api\/v1\/attempts\/([^/]+)\/finish$/);
    if (fin) return event.respondWith(finishAttempt(event, decodeURIComponent(fin[1])));
    return;
  }
  if (req.method !== "GET") return;

  if (req.mode === "navigate") return event.respondWith(navigation(event));
  if (DATA_PATHS.includes(url.pathname)) return event.respondWith(networkFirst(event, DATA));
  if (url.pathname.startsWith("/api/")) return;
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/3d/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:woff2?|ttf)$/.test(url.pathname)
  ) {
    return event.respondWith(cacheFirst(event, STATIC));
  }
});
