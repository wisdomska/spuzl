/**
 * Local demo data for the social and meta screens (friends, feed, leagues, leaderboards, crews, School Cup,
 * quests, badges, streak calendar). Dev only: refuses to run against anything but a local Supabase.
 *
 *   pnpm tsx scripts/dev-fixtures/social.mts <viewer-user-id> [--ceremony]
 *
 * The viewer is an existing player (sign in on /welcome first, then copy your id from /api/v1/me).
 * Demo players use @spuzl.local emails and the `demo_` nickname prefix is NOT used, so screens look real;
 * re-running reuses them. Never put this data in a migration.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(URL_ ?? "")) {
  console.error("dev fixtures only run against a local Supabase");
  process.exit(1);
}
const sb = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const viewer = process.argv[2];
const ceremony = process.argv.includes("--ceremony");
if (!viewer) {
  console.error("usage: social.mts <viewer-user-id> [--ceremony]");
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const must = (r: { data: any; error: { message: string } | null }, what: string) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};
const today = new Date().toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const monday = (() => {
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
})();

const PEOPLE: [string, string, string][] = [
  ["Kofi", "#FF8A3D", "18+"],
  ["Efua", "#8B7CFF", "16-17"],
  ["Yaw", "#3DDC84", "18+"],
  ["Zainab", "#FFD23F", "18+"],
  ["Akosua", "#B8F23A", "16-17"],
  ["Chidi", "#4D8BFF", "18+"],
  ["Kwame", "#FFC93C", "18+"],
  ["Adaeze", "#FF6B6B", "18+"],
  ["Tunde", "#FF8A3D", "18+"],
  ["Kojo", "#3DDC84", "13-15"],
  ["Esi", "#4D8BFF", "18+"],
  ["Musa", "#FF6B6B", "18+"],
  ["Abena", "#F27ADB", "18+"],
  ["Nana", "#2FD3E0", "16-17"],
  ["Ifeoma", "#8B7CFF", "18+"],
  ["Sena", "#FFD23F", "18+"],
  ["Kweku", "#FF8A3D", "18+"],
  ["Afia", "#3DDC84", "18+"],
  ["Emeka", "#4D8BFF", "18+"],
  ["Dede", "#FF6B6B", "16-17"],
  ["Fiifi", "#B8F23A", "18+"],
  ["Amara", "#F27ADB", "18+"],
  ["Selorm", "#2FD3E0", "18+"],
  ["Ngozi", "#FFC93C", "18+"],
  ["Bayo", "#8B7CFF", "18+"],
  ["Akua", "#3DDC84", "18+"],
  ["Elikem", "#FF8A3D", "18+"],
  ["Lagos_Lad", "#4D8BFF", "18+"],
  ["Speedy99", "#FF6B6B", "18+"],
];

async function person(nick: string, color: string, band: string): Promise<string> {
  const { data: existing } = await sb.from("players").select("id").eq("nickname", nick).maybeSingle();
  if (existing) return existing.id;
  const email = `${nick.toLowerCase()}@spuzl.local`;
  const created = await sb.auth.admin.createUser({ email, email_confirm: true, password: crypto.randomUUID() });
  let id = created.data.user?.id;
  if (!id) {
    const list = must(await sb.auth.admin.listUsers({ perPage: 1000 }), "list users");
    id = list.users.find((u: { email?: string }) => u.email === email)?.id;
  }
  if (!id) throw new Error(`user ${nick}`);
  must(
    await sb
      .from("players")
      .upsert({ id, nickname: nick, age_band: band, avatar_color: color, country: "GH", city: "Accra", is_guest: false }),
    `player ${nick}`,
  );
  return id;
}

const ids: Record<string, string> = {};
for (const [n, c, b] of PEOPLE) ids[n] = await person(n, c, b);
const others = PEOPLE.map(([n]) => ids[n]);
console.log(`demo players: ${others.length}`);

// Viewer: a believable mid-game profile.
must(await sb.from("players").update({ country: "GH", city: "Accra", sparks: 1284, xp: 9800, level: 15 }).eq("id", viewer), "viewer");

// School + School Cup
const { data: school } = await sb.from("schools").select("id").eq("code", "ACHI24").maybeSingle();
const schoolId =
  school?.id ??
  must(
    await sb
      .from("schools")
      .insert({ name: "Achimota School", city: "Accra", country: "GH", code: "ACHI24", verified_by: viewer })
      .select("id")
      .single(),
    "school",
  ).id;
must(
  await sb
    .from("players")
    .update({ school_id: schoolId })
    .in("id", [viewer, ...others.slice(0, 12)]),
  "school members",
);

// Friends: 4 accepted (with presence), 2 incoming requests.
for (const n of ["Kofi", "Efua", "Yaw", "Zainab", "Kwame", "Adaeze"]) {
  await sb
    .from("friendships")
    .upsert({ player_id: viewer, friend_id: ids[n], status: "accepted" }, { onConflict: "player_id,friend_id", ignoreDuplicates: true });
}
for (const n of ["Akosua", "Chidi"]) {
  await sb
    .from("friendships")
    .upsert({ player_id: ids[n], friend_id: viewer, status: "pending" }, { onConflict: "player_id,friend_id", ignoreDuplicates: true });
}
await sb.from("friendships").upsert({ player_id: ids.Akosua, friend_id: ids.Kofi, status: "accepted" }, { ignoreDuplicates: true });
await sb.from("friendships").upsert({ player_id: ids.Akosua, friend_id: ids.Yaw, status: "accepted" }, { ignoreDuplicates: true });
const now = Date.now();
const seen = (min: number) => new Date(now - min * 60_000).toISOString();
await sb
  .from("players")
  .update({ last_seen_at: seen(0), playing_game: "crownfall" })
  .eq("id", ids.Kofi);
await sb
  .from("players")
  .update({ last_seen_at: seen(0), playing_game: null })
  .eq("id", ids.Efua);
await sb
  .from("players")
  .update({ last_seen_at: seen(1), playing_game: null })
  .eq("id", ids.Yaw);
await sb
  .from("players")
  .update({ last_seen_at: seen(120), playing_game: null })
  .eq("id", ids.Zainab);
await sb
  .from("players")
  .update({ last_seen_at: seen(60 * 26), playing_game: null })
  .in("id", [ids.Kwame, ids.Adaeze]);

// Today's Crownfall board: viewer ~1:12, others around a minute.
const times = [51, 58, 61, 63, 65, 66, 67, 68, 69, 74, 77, 80, 83, 85, 90, 95, 101, 109, 115, 121];
const rows = others.slice(0, times.length).map((id, i) => ({
  date: today,
  game_id: "crownfall",
  player_id: id,
  time_ms: times[i] * 1000 + 300,
  hints: i % 5 === 0 ? 1 : 0,
  mistakes: i % 3,
  finished_at: new Date(now - i * 60_000).toISOString(),
}));
rows.push({
  date: today,
  game_id: "crownfall",
  player_id: viewer,
  time_ms: 72_400,
  hints: 0,
  mistakes: 0,
  finished_at: new Date().toISOString(),
});
must(await sb.from("daily_results").upsert(rows, { onConflict: "date,game_id,player_id", ignoreDuplicates: true }), "board");
for (const g of ["dusk", "weave", "quads"])
  await sb.from("daily_results").upsert(
    others.slice(0, 8).map((id, i) => ({
      date: today,
      game_id: g,
      player_id: id,
      time_ms: (60 + i * 7) * 1000,
      hints: 0,
      mistakes: 0,
      finished_at: new Date().toISOString(),
    })),
    { onConflict: "date,game_id,player_id", ignoreDuplicates: true },
  );

// Viewer history: October clears (calendar), Full Spuzl days, one frozen day, streak 12.
const hist: { date: string; game_id: string; player_id: string; time_ms: number; finished_at: string }[] = [];
for (let n = 1; n <= 30; n++) {
  if (n === 18 || n === 29) continue; // a miss and a frozen day
  hist.push({ date: day(n), game_id: "crownfall", player_id: viewer, time_ms: 48_000 + n * 900, finished_at: day(n) + "T12:00:00Z" });
}
await sb.from("daily_results").upsert(hist, { onConflict: "date,game_id,player_id", ignoreDuplicates: true });
for (const n of [3, 4, 9, 12, 16, 17, 22, 25, 28])
  await sb.rpc("svc_grant_reward", { p_player: viewer, p_source: "full_spuzl", p_ref: day(n), p_xp: 150, p_sparks: 0 });
await sb.from("streak_frozen_days").upsert({ player_id: viewer, day: day(18) }, { ignoreDuplicates: true });
await sb.from("streaks").upsert({ player_id: viewer, current: 12, best: 21, last_clear_date: today, freezes_held: 1 });
await sb.from("streaks").upsert({ player_id: ids.Kofi, current: 21, best: 30, last_clear_date: today });
for (const [g, n, ms] of [
  ["crownfall", 64, 48_000],
  ["quads", 51, 130_000],
  ["dash", 33, 91_000],
] as const) {
  const { count } = await sb.from("attempts").select("id", { count: "exact", head: true }).eq("player_id", viewer).eq("game_id", g);
  if ((count ?? 0) < n)
    await sb.from("attempts").insert(
      Array.from({ length: n - (count ?? 0) }, (_, i) => ({
        player_id: viewer,
        game_id: g,
        mode: "free",
        status: "cleared",
        time_ms: ms + i * 1500,
        finished_at: new Date().toISOString(),
        verified: true,
      })),
    );
}
for (const [track, rating] of [
  ["logic", 1080],
  ["line", 1250],
  ["shape", 940],
  ["number", 1100],
  ["word", 1460],
  ["clue", 980],
  ["reflex", 1120],
  ["duel", 1438],
] as const)
  await sb.from("ratings").upsert({ player_id: viewer, track, rating, games: 12 });
for (const b of ["first-clear", "streak-7", "early-bird", "social-5", "clean-10"])
  await sb.from("player_badges").upsert({ player_id: viewer, badge_id: b }, { ignoreDuplicates: true });

// This week's league (Gold Crown) with the viewer in 5th.
const { data: lm } = await sb
  .from("league_members")
  .select("league_id, leagues!inner(week_start)")
  .eq("player_id", viewer)
  .eq("leagues.week_start", monday)
  .maybeSingle();
let leagueId = lm?.league_id as string | undefined;
if (!leagueId) {
  leagueId = must(await sb.from("leagues").insert({ tier: 2, week_start: monday }).select("id").single(), "league").id;
  must(await sb.from("league_members").insert({ league_id: leagueId, player_id: viewer, points: 1702 }), "viewer member");
}
const pts = [
  2140, 1980, 1910, 1765, 1650, 1610, 1588, 1501, 1460, 1390, 1340, 1300, 1255, 1210, 1170, 1102, 1050, 990, 930, 870, 800, 760, 700, 640,
  560, 420, 380, 300,
];
await sb.from("league_members").upsert(
  others.slice(0, pts.length).map((id, i) => ({ league_id: leagueId, player_id: id, points: pts[i] })),
  { onConflict: "league_id,player_id", ignoreDuplicates: true },
);
if (ceremony) {
  const prevWeek = new Date(Date.parse(monday) - 7 * 86_400_000).toISOString().slice(0, 10);
  const prev = must(
    await sb.from("leagues").insert({ tier: 2, week_start: prevWeek, finalised_at: new Date().toISOString() }).select("id").single(),
    "prev league",
  ).id;
  const prevPts = [2300, 2210, 2050, 1880, 1702, 1690, 1640, 1500];
  must(
    await sb.from("league_members").insert([
      ...others.slice(0, 4).map((id, i) => ({ league_id: prev, player_id: id, points: prevPts[i], final_rank: i + 1, result: "promoted" })),
      { league_id: prev, player_id: viewer, points: 1702, final_rank: 5, result: "promoted" },
      ...others.slice(4, 7).map((id, i) => ({
        league_id: prev,
        player_id: id,
        points: prevPts[5 + i],
        final_rank: 6 + i,
        result: i < 2 ? "promoted" : "stayed",
      })),
    ]),
    "prev members",
  );
}

// Feed
const ev = must(
  await sb
    .from("feed_events")
    .insert([
      { player_id: ids.Kofi, kind: "clear", game_id: "crownfall", payload: { timeMs: 65_000, hints: 0 }, created_at: seen(4) },
      { player_id: ids.Zainab, kind: "streak", payload: { days: 30 }, created_at: seen(60) },
      { player_id: ids.Efua, kind: "badge", payload: { badge: "night-owl" }, created_at: seen(180) },
    ])
    .select("id"),
  "feed",
);
await sb.from("reactions").upsert(
  [
    { event_id: ev[0].id, player_id: ids.Yaw, reaction: "fire" },
    { event_id: ev[0].id, player_id: ids.Efua, reaction: "fire" },
    { event_id: ev[0].id, player_id: ids.Zainab, reaction: "wow" },
    { event_id: ev[1].id, player_id: ids.Kofi, reaction: "gg" },
    { event_id: ev[1].id, player_id: ids.Yaw, reaction: "fire" },
  ],
  { ignoreDuplicates: true },
);

// Crews: Shito Squad (viewer + 5) vs Lagos Lit
async function crew(name: string, owner: string, members: string[], code: string) {
  const { data: c } = await sb.from("crews").select("id").eq("name", name).maybeSingle();
  const id = c?.id ?? must(await sb.from("crews").insert({ name, owner_id: owner, join_code: code }).select("id").single(), name).id;
  for (const p of members)
    await sb
      .from("crew_members")
      .upsert({ crew_id: id, player_id: p, role: p === owner ? "captain" : "member" }, { ignoreDuplicates: true });
  return id;
}
const { data: vc } = await sb.from("crew_members").select("crew_id").eq("player_id", viewer).maybeSingle();
if (!vc) await crew("Shito Squad", ids.Kwame, [ids.Kwame, viewer, ids.Kofi, ids.Efua, ids.Yaw], "SHTQSX");
await crew("Lagos Lit", ids.Lagos_Lad, [ids.Lagos_Lad, ids.Chidi, ids.Emeka, ids.Ngozi], "LAGQSX");
for (const [n, xp] of [
  ["Kwame", 3120],
  ["Kofi", 2410],
  ["Efua", 1990],
  ["Yaw", 1620],
  ["Lagos_Lad", 6200],
  ["Chidi", 5100],
  ["Emeka", 4300],
  ["Ngozi", 2360],
] as const)
  await sb.rpc("svc_grant_reward", { p_player: ids[n], p_source: "demo", p_ref: monday, p_xp: xp, p_sparks: 0 });

// Quests: first daily quest complete and claimable.
const quests = (await import("../../lib/gamification/quests.ts")).questsForDate(today);
await sb.from("player_quests").upsert(
  [
    {
      player_id: viewer,
      quest_id: quests[0].id,
      period: today,
      progress: quests[0].goal.n,
      target: quests[0].goal.n,
      completed_at: new Date().toISOString(),
    },
    {
      player_id: viewer,
      quest_id: quests[2].id,
      period: today,
      progress: quests[2].goal.n,
      target: quests[2].goal.n,
      completed_at: new Date().toISOString(),
      claimed_at: new Date().toISOString(),
    },
    ...["w-1", "w-2", "w-3"].map((q) => ({
      player_id: viewer,
      quest_id: q,
      period: monday,
      progress: 1,
      target: 1,
      completed_at: new Date().toISOString(),
      claimed_at: new Date().toISOString(),
    })),
  ],
  { onConflict: "player_id,quest_id,period" },
);

// A class challenge the viewer teaches, with students from the school.
const { data: cup } = await sb.from("school_cups").select("id").eq("teacher_id", viewer).eq("class_name", "Form 2B").maybeSingle();
const cupId =
  cup?.id ??
  must(
    await sb
      .from("school_cups")
      .insert({
        school_id: schoolId,
        teacher_id: viewer,
        class_name: "Form 2B",
        games: ["crownfall", "quads", "deadon"],
        week_start: monday,
        ends_on: new Date(Date.parse(monday) + 4 * 86_400_000).toISOString().slice(0, 10),
        join_code: "FRM2BQ",
      })
      .select("id")
      .single(),
    "cup",
  ).id;
await sb.from("school_cup_members").upsert(
  ["Kwame", "Akosua", "Kofi", "Adaeze", "Yaw", "Efua", "Zainab"].map((n) => ({ cup_id: cupId, player_id: ids[n] })),
  { ignoreDuplicates: true },
);
console.log(`done. league ${leagueId}, cup ${cupId}`);
