import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { createRng } from "../../lib/rng";
import crownfall from "../../games/crownfall/logic";
import type { Difficulty } from "../../games/types";

/** Realtime E2E helpers: real players (anonymous Supabase users with profiles) in separate browser contexts. */
const env = Object.fromEntries(
  fs.existsSync(".env.local")
    ? fs
        .readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
    : [],
);
export const BASE = process.env.E2E_BASE ?? "http://localhost:3201";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
export const admin = () => createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

export const uniq = (p: string) => `${p}${Math.random().toString(36).slice(2, 7)}`;

export interface Player {
  id: string;
  nickname: string;
  context: BrowserContext;
  page: Page;
}

/** Signs a new guest in, creates the profile through the API, and puts the session cookie in a fresh context. */
export async function player(
  browser: Browser,
  prefix: string,
  opts: { viewport?: { width: number; height: number } } = {},
): Promise<Player> {
  const sb = createClient(SB_URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  const nickname = uniq(prefix);
  const res = await fetch(`${BASE}/api/v1/profile`, {
    method: "POST",
    headers: { authorization: `Bearer ${data.session!.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({
      nickname,
      ageBand: "18+",
      color: ["#2FD3E0", "#FF8A3D", "#8B7CFF", "#FFD23F", "#3DDC84", "#FF6B6B"][Math.floor(Math.random() * 6)],
    }),
  });
  if (!res.ok) throw new Error(`profile ${res.status} ${await res.text()}`);
  // Let @supabase/ssr write its own cookie format for this session.
  const jar: { name: string; value: string }[] = [];
  const ssr = createServerClient(SB_URL, ANON, {
    cookies: { getAll: () => jar, setAll: (list) => list.forEach((c) => jar.push({ name: c.name, value: c.value })) },
  });
  await ssr.auth.setSession({ access_token: data.session!.access_token, refresh_token: data.session!.refresh_token });
  const context = await browser.newContext({ viewport: opts.viewport ?? { width: 390, height: 844 }, baseURL: BASE });
  await context.addCookies(jar.map((c) => ({ name: c.name, value: c.value, url: BASE })));
  await context.addInitScript(() => {
    try {
      localStorage.setItem("spuzl.audio", JSON.stringify({ sfx: false, music: false, haptics: false }));
    } catch {
      /* ignore */
    }
  });
  const page = await context.newPage();
  return { id: data.user!.id, nickname, context, page };
}

/** The shared round puzzle and its solution, exactly as the server generates it. */
export function crownfallRound(matchId: string, setNo: number, round: number, difficulty: string) {
  const g = crownfall.generate(createRng(`mp:${matchId}:${setNo}:${round}`), difficulty as Difficulty);
  const n = g.puzzle.size;
  const state = new Array(n * n).fill(0);
  g.solution.forEach((c, r) => (state[r * n + c] = 2));
  return { n, state, crowns: g.solution.map((c, r) => r * n + c) };
}

/** Plays a Crownfall solution through the real board UI: Crown tool, then tap each crown cell. */
export async function solveCrownfallInUi(page: Page, crowns: number[]) {
  await page.getByRole("button", { name: "Crown" }).click();
  const cells = page.locator('[role="gridcell"]');
  for (const i of crowns) await cells.nth(i).click();
}

/** Same-origin API call from inside the page, with the player's own session cookie. */
export async function inPage<T = unknown>(page: Page, path: string, json?: unknown): Promise<{ status: number; data: T }> {
  return page.evaluate(
    async ([p, body]) => {
      const r = await fetch(p as string, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const t = await r.text();
      return { status: r.status, data: t ? JSON.parse(t) : null };
    },
    [path, json] as const,
  ) as Promise<{ status: number; data: T }>;
}

export const matchIdFrom = (url: string) => new URL(url).searchParams.get("m")!;
