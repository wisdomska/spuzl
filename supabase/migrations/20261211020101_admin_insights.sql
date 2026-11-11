-- Admin overhaul (B): owner-facing numbers for the admin Metrics page.
--
-- private.admin_insights(from, to): per GMT day and for the whole range (days run 00:00 to 24:00 GMT), test
-- players left out everywhere (players.is_test), read only:
--   active, active_saved   players who started any game (an attempt, the tutorial included) or made a board-game
--                          move that day; of them, how many have a saved account now (players.is_guest = false).
--                          The range total counts each player once (not the sum of the days).
--   active_last7           (range total only) the same, over the last 7 days of the range.
--   new_saved              players created that day who have a saved account now (created itself is in
--                          admin_metrics as `created`).
--   rt_d1_cohort/kept      next-day return measured ON the row's day: players whose first activity ever was the day
--   rt_d7_cohort/kept      before (7 days before) and, of them, how many were active on the row's day. Same rule as
--                          private.admin_retention_cohorts (it is called with the range shifted back 1 and 7 days),
--                          so a 7-day range always has a week-later answer. A return day that is not over yet has
--                          cohort 0.
--   puzzles_started        attempts started that day, the tutorial left out (solo, Daily, Daily Five, Duel and
--   puzzles_cleared        Party rounds); of them, how many were cleared.
--   board_plays            players who made at least one move in a board game created that day (one per player
--                          per game).
--   board_games            board games created that day with at least one move and no test player;
--   board_bot_games        of them, games against the computer.
--   duels, duels_vs_computer Duels created that day that started (playing, between rounds or finished, or a round
--                          started), no test player in them; of them, against the computer.
--   parties, party_players Party rooms (matches kind 'race': races, Draw It, Two Truths) created that day that
--                          started (same rule, or a word round began), no test player; players (not spectators)
--                          in them.
--   friends_made           accepted friendships, dated by when the request was made (no accept time is stored),
--                          neither side a test player.
--   sparks_earned          Sparks added to players' balances by playing (ledger amounts > 0, team gifts left out);
--   sparks_spent           Sparks taken out (ledger amounts < 0, team corrections left out);
--   shop_buys, shop_buyers paid Shop purchases (ledger source 'shop'), and the players who made them.
--   reports_sent           reports filed by players.
--   feedback_sent          feedback messages (signed-out senders included; a test player's are not).
--   streak_3, streak_7     (range total only, a snapshot of now) players whose current streak is 3+ (7+) days.
--   top_games              (range total only) per game id: plays (puzzles_started plus board_plays) and distinct
--                          players.
-- public.svc_admin_metrics is redefined with every existing part (up to 20261207001001, the weekly recap) plus
-- this one.
--
-- Live now (and Overview) use the same activity rule as Metrics and retention: private.admin_kpis (dau,
-- dau_yesterday, dau_last_week) and private.admin_activity_series (players per 30 minutes) now also count a
-- board-game move, not only a started attempt. Both are copied from 20261103000001 with every other part kept
-- (same keys and columns, test players left out). public.svc_admin_kpis / svc_admin_activity_series are unchanged.
-- No table, data or grant changes; the new function is service-role only like the others.
--
-- Rollback:
--   re-run `create or replace function private.admin_kpis` and `private.admin_activity_series` from
--   supabase/migrations/20261103000001_admin.sql;
--   re-run the `create or replace function public.svc_admin_metrics` statement (and its revoke and grant) from
--   supabase/migrations/20261207001001_weekly_recap.sql, then:
--   drop function if exists private.admin_insights(date, date);
--   delete from supabase_migrations.schema_migrations where version = '20261211020101';

create or replace function private.admin_insights(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  x as (select d from days union all select null::date),
  real as (select p.id, not p.is_guest as saved from public.players p where not coalesce(p.is_test, false)),
  -- Activity: the same sources as the retention numbers (an attempt started, or a board-game move).
  act as (
    select a.player_id, (a.started_at at time zone 'utc')::date as d
    from public.attempts a, b where a.started_at >= b.lo and a.started_at < b.hi
    union
    select m.player_id, (m.created_at at time zone 'utc')::date
    from public.board_moves m, b where m.created_at >= b.lo and m.created_at < b.hi
  ),
  actr as (select y.player_id, y.d, r.saved from act y join real r on r.id = y.player_id),
  newp as (
    select (p.created_at at time zone 'utc')::date as d, not p.is_guest as saved
    from public.players p, b where not coalesce(p.is_test, false) and p.created_at >= b.lo and p.created_at < b.hi
  ),
  puz as (
    select (a.started_at at time zone 'utc')::date as d, a.player_id, a.game_id, a.status
    from public.attempts a join real r on r.id = a.player_id, b
    where a.started_at >= b.lo and a.started_at < b.hi and a.mode <> 'tutorial'
  ),
  bgm as (
    select bm.id, (bm.created_at at time zone 'utc')::date as d, bm.game_id, bm.bot
    from public.board_matches bm, b
    where bm.created_at >= b.lo and bm.created_at < b.hi
      and not exists (select 1 from public.players p where p.id = any (bm.players) and p.is_test)
  ),
  bplay as (
    select distinct g.d, g.id, g.game_id, m.player_id
    from bgm g join public.board_moves m on m.match_id = g.id join real r on r.id = m.player_id
  ),
  -- Board plays for game counts include a real player's moves in a game with a test player too.
  bplay_all as (
    select distinct (bm.created_at at time zone 'utc')::date as d, bm.id, bm.game_id, m.player_id
    from public.board_matches bm join public.board_moves m on m.match_id = bm.id join real r on r.id = m.player_id, b
    where bm.created_at >= b.lo and bm.created_at < b.hi
  ),
  mm as (
    select m.id, m.kind, (m.created_at at time zone 'utc')::date as d, m.is_bot
    from public.matches m, b
    where m.created_at >= b.lo and m.created_at < b.hi
      and (m.status in ('playing', 'round_end', 'finished') or m.round_started_at is not null
           or exists (select 1 from public.party_rounds pr where pr.match_id = m.id))
      and not exists (select 1 from public.match_players mp join public.players p on p.id = mp.player_id
                      where mp.match_id = m.id and p.is_test)
  ),
  pp as (
    select m.d, mp.player_id from mm m join public.match_players mp on mp.match_id = m.id and not mp.spectator
    where m.kind = 'race'
  ),
  fr as (
    select (f.created_at at time zone 'utc')::date as d
    from public.friendships f join real r1 on r1.id = f.player_id join real r2 on r2.id = f.friend_id, b
    where f.status = 'accepted' and f.created_at >= b.lo and f.created_at < b.hi
  ),
  sp as (
    select (s.created_at at time zone 'utc')::date as d, s.player_id, s.source, s.amount
    from public.sparks_ledger s join real r on r.id = s.player_id, b
    where s.created_at >= b.lo and s.created_at < b.hi and s.source <> 'admin'
  ),
  rep as (
    select (rp.created_at at time zone 'utc')::date as d
    from public.reports rp join real r on r.id = rp.reporter_id, b
    where rp.created_at >= b.lo and rp.created_at < b.hi
  ),
  fb as (
    select (f.created_at at time zone 'utc')::date as d
    from public.feedback f, b
    where f.created_at >= b.lo and f.created_at < b.hi
      and (f.player_id is null or exists (select 1 from real r where r.id = f.player_id))
  ),
  -- Return measured on each day of the range: cohorts 1 and 7 days earlier.
  r1 as (select private.admin_retention_cohorts(p_from - 1, p_to - 1) as v),
  r7 as (select private.admin_retention_cohorts(p_from - 7, p_to - 7) as v),
  ret as (
    select ((e.v ->> 'date')::date + 1) as d, (e.v ->> 'ret_d1_cohort')::int as d1c, (e.v ->> 'ret_d1_kept')::int as d1k,
      0 as d7c, 0 as d7k
    from r1, jsonb_array_elements(r1.v -> 'days') e(v)
    union all
    select ((e.v ->> 'date')::date + 7), 0, 0, (e.v ->> 'ret_d7_cohort')::int, (e.v ->> 'ret_d7_kept')::int
    from r7, jsonb_array_elements(r7.v -> 'days') e(v)
  ),
  -- One aggregate per source: a row per day plus the whole range (d = null), so distinct counts stay exact.
  ga as (
    select d, count(distinct player_id) as active, count(distinct player_id) filter (where saved) as active_saved
    from actr group by grouping sets ((d), ())
  ),
  gn as (select d, count(*) filter (where saved) as new_saved from newp group by grouping sets ((d), ())),
  gr as (
    select d, sum(d1c) as d1c, sum(d1k) as d1k, sum(d7c) as d7c, sum(d7k) as d7k from ret group by grouping sets ((d), ())
  ),
  gp as (
    select d, count(*) as started, count(*) filter (where status = 'cleared') as cleared from puz group by grouping sets ((d), ())
  ),
  gbp as (select d, count(*) as plays from bplay_all group by grouping sets ((d), ())),
  gbg as (
    select g.d, count(*) as games, count(*) filter (where g.bot) as bot_games
    from bgm g where exists (select 1 from bplay p where p.id = g.id) group by grouping sets ((g.d), ())
  ),
  gm as (
    select d, count(*) filter (where kind = 'duel') as duels, count(*) filter (where kind = 'duel' and is_bot) as duels_bot,
      count(*) filter (where kind = 'race') as parties
    from mm group by grouping sets ((d), ())
  ),
  gpp as (select d, count(distinct player_id) as players from pp group by grouping sets ((d), ())),
  gf as (select d, count(*) as n from fr group by grouping sets ((d), ())),
  gs as (
    select d, sum(amount) filter (where amount > 0) as earned, -sum(amount) filter (where amount < 0) as spent,
      count(*) filter (where source = 'shop' and amount < 0) as buys,
      count(distinct player_id) filter (where source = 'shop' and amount < 0) as buyers
    from sp group by grouping sets ((d), ())
  ),
  grp as (select d, count(*) as n from rep group by grouping sets ((d), ())),
  gfb as (select d, count(*) as n from fb group by grouping sets ((d), ())),
  per as (
    select x.d, jsonb_build_object(
      'active', coalesce(ga.active, 0),
      'active_saved', coalesce(ga.active_saved, 0),
      'new_saved', coalesce(gn.new_saved, 0),
      'rt_d1_cohort', coalesce(gr.d1c, 0),
      'rt_d1_kept', coalesce(gr.d1k, 0),
      'rt_d7_cohort', coalesce(gr.d7c, 0),
      'rt_d7_kept', coalesce(gr.d7k, 0),
      'puzzles_started', coalesce(gp.started, 0),
      'puzzles_cleared', coalesce(gp.cleared, 0),
      'board_plays', coalesce(gbp.plays, 0),
      'board_games', coalesce(gbg.games, 0),
      'board_bot_games', coalesce(gbg.bot_games, 0),
      'duels', coalesce(gm.duels, 0),
      'duels_vs_computer', coalesce(gm.duels_bot, 0),
      'parties', coalesce(gm.parties, 0),
      'party_players', coalesce(gpp.players, 0),
      'friends_made', coalesce(gf.n, 0),
      'sparks_earned', coalesce(gs.earned, 0),
      'sparks_spent', coalesce(gs.spent, 0),
      'shop_buys', coalesce(gs.buys, 0),
      'shop_buyers', coalesce(gs.buyers, 0),
      'reports_sent', coalesce(grp.n, 0),
      'feedback_sent', coalesce(gfb.n, 0)) as v
    from x
    left join ga on ga.d is not distinct from x.d
    left join gn on gn.d is not distinct from x.d
    left join gr on gr.d is not distinct from x.d
    left join gp on gp.d is not distinct from x.d
    left join gbp on gbp.d is not distinct from x.d
    left join gbg on gbg.d is not distinct from x.d
    left join gm on gm.d is not distinct from x.d
    left join gpp on gpp.d is not distinct from x.d
    left join gf on gf.d is not distinct from x.d
    left join gs on gs.d is not distinct from x.d
    left join grp on grp.d is not distinct from x.d
    left join gfb on gfb.d is not distinct from x.d
  ),
  plays as (
    select p.game_id, p.player_id from puz p
    union all
    select g.game_id, g.player_id from bplay_all g
  ),
  top as (
    select coalesce(jsonb_object_agg(t.game_id, jsonb_build_object('plays', t.plays, 'players', t.players)), '{}'::jsonb) as v
    from (select game_id, count(*) as plays, count(distinct player_id) as players from plays group by game_id) t
  )
  select jsonb_build_object(
    'total', (select v from per where d is null) || jsonb_build_object(
      'active_last7', (select count(distinct a.player_id) from actr a where a.d > p_to - 7),
      'streak_3', (select count(*) from public.streaks s join real r on r.id = s.player_id where s.current >= 3),
      'streak_7', (select count(*) from public.streaks s join real r on r.id = s.player_id where s.current >= 7),
      'top_games', (select v from top)),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;
revoke execute on function private.admin_insights(date, date) from public, anon, authenticated;

create or replace function public.svc_admin_metrics(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with m as (select private.admin_metrics(p_from, p_to) as v),
  f as (select private.admin_client_funnel(p_from, p_to) as v),
  db as (select private.admin_duel_bands(p_from, p_to) as v),
  pm as (select private.admin_party_metrics(p_from, p_to) as v),
  p as (select private.admin_prompt_metrics(p_from, p_to) as v),
  x as (select private.admin_daily_five(p_from, p_to) as v),
  tw as (select private.admin_tap_warmth(p_from, p_to) as v),
  fc as (select private.admin_first_clear(p_from, p_to) as v),
  pr as (select private.admin_practice(p_from, p_to) as v),
  rc as (select private.admin_retention_cohorts(p_from, p_to) as v),
  gv as (select private.admin_game_over(p_from, p_to) as v),
  gr as (select private.admin_growth(p_from, p_to) as v),
  sn as (select private.admin_streak_nudge(p_from, p_to) as v),
  wr as (select private.admin_weekly_recap(p_from, p_to) as v),
  ins as (select private.admin_insights(p_from, p_to) as v)
  select m.v || jsonb_build_object(
    'total', (m.v -> 'total')
      || coalesce(f.v -> 'total', '{}'::jsonb)
      || coalesce(db.v -> 'total', '{}'::jsonb)
      || coalesce(pm.v -> 'total', '{}'::jsonb)
      || coalesce(p.v -> 'total', '{}'::jsonb)
      || coalesce(x.v -> 'total', '{}'::jsonb)
      || coalesce(tw.v -> 'total', '{}'::jsonb)
      || coalesce(fc.v -> 'total', '{}'::jsonb)
      || coalesce(pr.v -> 'total', '{}'::jsonb)
      || coalesce(rc.v -> 'total', '{}'::jsonb)
      || coalesce(gv.v -> 'total', '{}'::jsonb)
      || coalesce(gr.v -> 'total', '{}'::jsonb)
      || coalesce(sn.v -> 'total', '{}'::jsonb)
      || coalesce(wr.v -> 'total', '{}'::jsonb)
      || coalesce(ins.v -> 'total', '{}'::jsonb),
    'days', coalesce((
      select jsonb_agg(md.v
          || coalesce(fd.v - 'date', '{}'::jsonb)
          || coalesce(dbd.v - 'date', '{}'::jsonb)
          || coalesce(pmd.v - 'date', '{}'::jsonb)
          || coalesce(pd.v - 'date', '{}'::jsonb)
          || coalesce(xd.v - 'date', '{}'::jsonb)
          || coalesce(twd.v - 'date', '{}'::jsonb)
          || coalesce(fcd.v - 'date', '{}'::jsonb)
          || coalesce(prd.v - 'date', '{}'::jsonb)
          || coalesce(rcd.v - 'date', '{}'::jsonb)
          || coalesce(gvd.v - 'date', '{}'::jsonb)
          || coalesce(grd.v - 'date', '{}'::jsonb)
          || coalesce(snd.v - 'date', '{}'::jsonb)
          || coalesce(wrd.v - 'date', '{}'::jsonb)
          || coalesce(insd.v - 'date', '{}'::jsonb)
        order by md.i)
      from jsonb_array_elements(m.v -> 'days') with ordinality md(v, i)
      left join jsonb_array_elements(f.v -> 'days') fd(v) on fd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(db.v -> 'days') dbd(v) on dbd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(pm.v -> 'days') pmd(v) on pmd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(p.v -> 'days') pd(v) on pd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(x.v -> 'days') xd(v) on xd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(tw.v -> 'days') twd(v) on twd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(fc.v -> 'days') fcd(v) on fcd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(pr.v -> 'days') prd(v) on prd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(rc.v -> 'days') rcd(v) on rcd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(gv.v -> 'days') gvd(v) on gvd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(gr.v -> 'days') grd(v) on grd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(sn.v -> 'days') snd(v) on snd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(wr.v -> 'days') wrd(v) on wrd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(ins.v -> 'days') insd(v) on insd.v ->> 'date' = md.v ->> 'date'
    ), '[]'::jsonb))
  from m, f, db, pm, p, x, tw, fc, pr, rc, gv, gr, sn, wr, ins
$$;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;

-- Live now: a board-game move counts as playing, like everywhere else on the admin Metrics page.
create or replace function private.admin_kpis(p_today date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with real as (select id from public.players where not is_test),
  act as (
    select a.player_id, a.started_at as at from public.attempts a
    where a.started_at >= (p_today - 7)::timestamp at time zone 'utc' and a.started_at < (p_today + 1)::timestamp at time zone 'utc'
    union all
    select m.player_id, m.created_at from public.board_moves m
    where m.created_at >= (p_today - 7)::timestamp at time zone 'utc' and m.created_at < (p_today + 1)::timestamp at time zone 'utc'
  ),
  day_active as (
    select (x.at at time zone 'utc')::date as d, count(distinct x.player_id) as n
    from act x join real r on r.id = x.player_id
    group by 1
  )
  select jsonb_build_object(
    'date', p_today,
    'players_now', (select count(*) from public.players p where not p.is_test and p.last_seen_at > now() - interval '5 minutes'),
    'dau', coalesce((select n from day_active where d = p_today), 0),
    'dau_yesterday', coalesce((select n from day_active where d = p_today - 1), 0),
    'dau_last_week', coalesce((select n from day_active where d = p_today - 7), 0),
    'clears_today', (select count(*) from public.daily_results r join real on real.id = r.player_id where r.date = p_today),
    'flagged', (select count(*) from public.attempts a where a.status = 'flagged'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'banned', (select count(*) from public.players where banned_at is not null)
  )
$$;

-- Players who started an attempt or made a board-game move in each 30 minute slot of the last 24 hours (48 slots,
-- oldest first).
create or replace function private.admin_activity_series(p_now timestamptz)
returns table (slot_start timestamptz, players bigint)
language sql stable security definer set search_path = '' as $$
  with slots as (
    select date_bin('30 minutes', p_now, timestamptz '2000-01-01') - make_interval(mins => 30 * k) as s
    from generate_series(0, 47) k
  ),
  act as (
    select a.player_id, a.started_at as at from public.attempts a
    where a.started_at >= date_bin('30 minutes', p_now, timestamptz '2000-01-01') - interval '1410 minutes'
    union all
    select m.player_id, m.created_at from public.board_moves m
    where m.created_at >= date_bin('30 minutes', p_now, timestamptz '2000-01-01') - interval '1410 minutes'
  )
  select s.s, (select count(distinct x.player_id) from act x join public.players p on p.id = x.player_id and not p.is_test
               where x.at >= s.s and x.at < s.s + interval '30 minutes')
  from slots s order by s.s
$$;
revoke execute on function private.admin_kpis(date), private.admin_activity_series(timestamptz) from public, anon, authenticated;
