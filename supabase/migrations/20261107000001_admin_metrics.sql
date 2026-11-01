-- Admin Metrics page (admin cascade): first-party client metrics and one aggregation entry point.
--
-- public.client_metrics holds anonymous, PII-free client measurements that the database cannot see otherwise:
-- tap-to-board latency, hint-confirm cancels and shares. No player id, no IP, no URL: a name, an optional game,
-- mode and kind label, and an optional duration. Written only by POST /api/v1/metrics with the service role;
-- nobody else can read or write it. Rows older than 180 days are deleted nightly.
--
-- svc_admin_metrics(from, to) returns every number on /admin/metrics for the GMT days from..to (inclusive), as
-- a range summary plus one row per day. Test players are excluded wherever a row links to a player.
--
-- Rollback:
--   select cron.unschedule('spuzl-client-metrics-prune');
--   drop function if exists public.svc_admin_metrics(date, date);
--   drop function if exists private.admin_metrics(date, date);
--   drop index if exists public.players_created_idx;
--   drop index if exists public.matches_created_idx;
--   drop table if exists public.client_metrics;

create table if not exists public.client_metrics (
  id bigint generated always as identity primary key,
  name text not null check (name in ('tap_to_board', 'hint_cancel', 'share')),
  game_id text check (game_id ~ '^[a-z0-9-]{2,32}$'),
  mode text check (mode ~ '^[a-z_]{1,16}$'),
  kind text check (kind ~ '^[a-z_]{1,16}$'),
  value_ms integer check (value_ms between 0 and 120000),
  created_at timestamptz not null default now()
);
create index if not exists client_metrics_name_created_idx on public.client_metrics (name, created_at);
alter table public.client_metrics enable row level security;
alter table public.client_metrics force row level security;
revoke all on public.client_metrics from public, anon, authenticated;

-- The cohort and duel queries filter on these by range.
create index if not exists players_created_idx on public.players (created_at);
create index if not exists matches_created_idx on public.matches (created_at) where kind = 'duel';

create or replace function private.admin_metrics(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  cm as (
    select (c.created_at at time zone 'utc')::date as d, c.name, c.kind, c.value_ms
    from public.client_metrics c, b where c.created_at >= b.lo and c.created_at < b.hi
  ),
  solo as (
    select (a.started_at at time zone 'utc')::date as d, a.mode, a.status, a.hints, a.started_at, a.first_move_at, a.finished_at
    from public.attempts a join public.players p on p.id = a.player_id and not p.is_test, b
    where a.started_at >= b.lo and a.started_at < b.hi and a.mode in ('daily', 'free', 'archive', 'challenge')
  ),
  fm as (
    select d, extract(epoch from first_move_at - started_at) * 1000 as ms from solo
    where first_move_at is not null and first_move_at >= started_at
  ),
  done as (select * from solo where status <> 'in_progress'),
  cohort as (
    select (p.created_at at time zone 'utc')::date as d,
      exists (select 1 from public.attempts a where a.player_id = p.id and a.mode = 'tutorial') as tut,
      exists (select 1 from public.attempts a where a.player_id = p.id and a.mode = 'tutorial' and a.status = 'cleared') as tut_clear,
      exists (select 1 from public.attempts a where a.player_id = p.id and a.mode <> 'tutorial') as played
    from public.players p, b where not p.is_test and p.created_at >= b.lo and p.created_at < b.hi
  ),
  duels as (
    select (m.created_at at time zone 'utc')::date as d, m.status, m.result, m.is_bot, m.code
    from public.matches m, b
    where m.kind = 'duel' and m.created_at >= b.lo and m.created_at < b.hi
      and not exists (select 1 from public.match_players mp join public.players p on p.id = mp.player_id
                      where mp.match_id = m.id and p.is_test)
  ),
  finished_matches as (
    select (m.finished_at at time zone 'utc')::date as d from public.matches m, b
    where m.status = 'finished' and m.finished_at >= b.lo and m.finished_at < b.hi
  ),
  clears as (
    select (a.finished_at at time zone 'utc')::date as d
    from public.attempts a join public.players p on p.id = a.player_id and not p.is_test, b
    where a.status = 'cleared' and a.finished_at >= b.lo and a.finished_at < b.hi
      and a.mode in ('daily', 'free', 'archive', 'challenge')
    union all select d from finished_matches
  ),
  -- One row per day, plus the whole range as d = null (grouping sets keep the percentiles exact).
  tap as (
    select d, kind, count(*) as n,
      round(percentile_cont(0.5) within group (order by value_ms))::integer as p50,
      round(percentile_cont(0.95) within group (order by value_ms))::integer as p95
    from cm where name = 'tap_to_board' and value_ms is not null and kind in ('tap', 'load')
    group by grouping sets ((d, kind), (kind))
  ),
  fmq as (
    select d, count(*) as n,
      round(percentile_cont(0.5) within group (order by ms))::integer as p50,
      round(percentile_cont(0.95) within group (order by ms))::integer as p95
    from fm group by grouping sets ((d), ())
  ),
  agg as (
    select x.d,
      (select count(*) from cohort c where x.d is null or c.d = x.d) as created,
      (select count(*) from cohort c where (x.d is null or c.d = x.d) and c.tut) as tutorial_started,
      (select count(*) from cohort c where (x.d is null or c.d = x.d) and c.tut_clear) as tutorial_cleared,
      (select count(*) from cohort c where (x.d is null or c.d = x.d) and c.played) as played,
      (select count(*) from done s where x.d is null or s.d = x.d) as attempts,
      (select count(*) from done s where (x.d is null or s.d = x.d) and s.hints > 0) as hinted,
      (select coalesce(sum(s.hints), 0) from done s where x.d is null or s.d = x.d) as hints_used,
      (select count(*) from done s where (x.d is null or s.d = x.d) and s.hints > 0 and s.status = 'abandoned') as hinted_abandoned,
      (select count(*) from cm c where (x.d is null or c.d = x.d) and c.name = 'hint_cancel') as hint_cancels,
      (select count(*) from duels m where (x.d is null or m.d = x.d) and m.status in ('playing', 'round_end', 'finished')) as duels_started,
      (select count(*) from duels m where (x.d is null or m.d = x.d) and m.result in ('left', 'abandon')) as duels_abandoned,
      (select count(*) from duels m where (x.d is null or m.d = x.d) and m.code is null and m.status <> 'queue') as duels_matchmade,
      (select count(*) from duels m where (x.d is null or m.d = x.d) and m.is_bot) as duels_bot,
      (select count(*) from solo s where (x.d is null or s.d = x.d) and s.mode = 'daily') as daily_started,
      (select count(*) from solo s where (x.d is null or s.d = x.d) and s.mode = 'daily' and s.status = 'cleared') as daily_cleared,
      (select count(*) from cm c where (x.d is null or c.d = x.d) and c.name = 'share') as shares,
      (select count(*) from clears c where x.d is null or c.d = x.d) as finished_games
    from (select d from days union all select null::date) x
  ),
  per as (
    select a.d, jsonb_build_object(
      'tap_n', coalesce(t.n, 0), 'tap_p50', t.p50, 'tap_p95', t.p95,
      'load_n', coalesce(l.n, 0), 'load_p50', l.p50, 'load_p95', l.p95,
      'created', a.created, 'tutorial_started', a.tutorial_started, 'tutorial_cleared', a.tutorial_cleared, 'played', a.played,
      'first_move_n', coalesce(f.n, 0), 'first_move_p50', f.p50, 'first_move_p95', f.p95,
      'attempts', a.attempts, 'hinted', a.hinted, 'hints_used', a.hints_used, 'hinted_abandoned', a.hinted_abandoned,
      'hint_cancels', a.hint_cancels,
      'duels_started', a.duels_started, 'duels_abandoned', a.duels_abandoned, 'duels_matchmade', a.duels_matchmade, 'duels_bot', a.duels_bot,
      'daily_started', a.daily_started, 'daily_cleared', a.daily_cleared,
      'shares', a.shares, 'finished_games', a.finished_games) as v
    from agg a
    left join tap t on t.kind = 'tap' and t.d is not distinct from a.d
    left join tap l on l.kind = 'load' and l.d is not distinct from a.d
    left join fmq f on f.d is not distinct from a.d
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total', (select v from per where d is null),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;

create or replace function public.svc_admin_metrics(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$ select private.admin_metrics(p_from, p_to) $$;

revoke execute on function private.admin_metrics(date, date) from public, anon, authenticated;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;

select cron.unschedule('spuzl-client-metrics-prune') where exists (select 1 from cron.job where jobname = 'spuzl-client-metrics-prune');
select cron.schedule('spuzl-client-metrics-prune', '23 3 * * *',
  $$delete from public.client_metrics where created_at < now() - interval '180 days'$$);
