-- R4-11: retention counts Board Bay moves as a day's activity.
--
-- A player's day of activity was "started an attempt" (solo, Duel and Party rounds). Board Bay games (chess,
-- draughts, oware, ludo, Four Up, Flip, live and async) write public.board_moves instead, so a player who only
-- plays Board Bay looked like they never came back. Now a day counts when the player started an attempt OR made a
-- Board Bay move, both for the cohort day (first activity ever) and for the day they came back:
--   private.admin_retention_cohorts(from, to)  admin Metrics retention cohort table (and CSV), same keys
--   private.admin_retention(today)             Live ops D1 and D7 (svc_admin_retention), same keys
-- Both are redefined from their latest definitions (20261202000601 and 20261103000001) with only the activity source
-- widened; test players stay out. public.svc_admin_metrics and public.svc_admin_retention are unchanged (they call
-- these by name). New index board_moves_player_time_idx (player_id, created_at) serves the per-player lookups.
-- Read only; no data changes.
--
-- Rollback:
--   re-run `create or replace function private.admin_retention_cohorts` (and its revoke) from
--   supabase/migrations/20261202000601_retention_cohorts_metric.sql and `create or replace function
--   private.admin_retention` from supabase/migrations/20261103000001_admin.sql, then:
--   drop index if exists public.board_moves_player_time_idx;
--   delete from supabase_migrations.schema_migrations where version = '20261210110101';

create index if not exists board_moves_player_time_idx on public.board_moves (player_id, created_at);

create or replace function private.admin_retention_cohorts(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi,
      (now() at time zone 'utc')::date as today
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  -- Players active in the range (an attempt or a Board Bay move) whose first activity ever is in the range.
  cand as (
    select a.player_id
    from public.attempts a join public.players p on p.id = a.player_id and not coalesce(p.is_test, false), b
    where a.started_at >= b.lo and a.started_at < b.hi
    union
    select m.player_id
    from public.board_moves m join public.players p on p.id = m.player_id and not coalesce(p.is_test, false), b
    where m.created_at >= b.lo and m.created_at < b.hi
  ),
  firsts as (
    select c.player_id, least(
      (select min(a.started_at) from public.attempts a where a.player_id = c.player_id),
      (select min(m.created_at) from public.board_moves m where m.player_id = c.player_id)) as first_at
    from cand c
  ),
  cohort as (
    select f.player_id, (f.first_at at time zone 'utc')::date as d
    from firsts f, b where f.first_at >= b.lo and f.first_at < b.hi
  ),
  kept as (
    select c.d,
      c.d + 1 < b.today as d1_due,
      c.d + 7 < b.today as d7_due,
      exists (select 1 from public.attempts a where a.player_id = c.player_id
              and a.started_at >= (c.d + 1)::timestamp at time zone 'utc' and a.started_at < (c.d + 2)::timestamp at time zone 'utc')
        or exists (select 1 from public.board_moves m where m.player_id = c.player_id
              and m.created_at >= (c.d + 1)::timestamp at time zone 'utc' and m.created_at < (c.d + 2)::timestamp at time zone 'utc') as d1,
      exists (select 1 from public.attempts a where a.player_id = c.player_id
              and a.started_at >= (c.d + 7)::timestamp at time zone 'utc' and a.started_at < (c.d + 8)::timestamp at time zone 'utc')
        or exists (select 1 from public.board_moves m where m.player_id = c.player_id
              and m.created_at >= (c.d + 7)::timestamp at time zone 'utc' and m.created_at < (c.d + 8)::timestamp at time zone 'utc') as d7
    from cohort c, b
  ),
  per as (
    select x.d, jsonb_build_object(
      'ret_cohort', count(k.d),
      'ret_d1_cohort', count(k.d) filter (where k.d1_due),
      'ret_d1_kept', count(k.d) filter (where k.d1_due and k.d1),
      'ret_d7_cohort', count(k.d) filter (where k.d7_due),
      'ret_d7_kept', count(k.d) filter (where k.d7_due and k.d7)) as v
    from (select d from days union all select null::date) x
    left join kept k on x.d is null or k.d = x.d
    group by x.d
  )
  select jsonb_build_object(
    'total', (select v from per where d is null),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;
revoke execute on function private.admin_retention_cohorts(date, date) from public, anon, authenticated;

-- Live ops D1 and D7: of the players first active on day c, the share active again on c + 1 (D1) or c + 7 (D7),
-- pooled over the last 7 complete cohorts. Active = started an attempt or made a Board Bay move.
create or replace function private.admin_retention(p_today date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with act as (
    select a.player_id, a.started_at as at from public.attempts a
    union all
    select m.player_id, m.created_at from public.board_moves m
  ),
  days as (
    select x.player_id, (x.at at time zone 'utc')::date as d
    from act x join public.players p on p.id = x.player_id and not p.is_test
    where x.at >= (p_today - 30)::timestamp at time zone 'utc'
    group by 1, 2
  ),
  firsts as (
    select x.player_id, min((x.at at time zone 'utc')::date) as c
    from act x join public.players p on p.id = x.player_id and not p.is_test
    group by 1
  ),
  d1 as (
    select count(*) as cohort, count(*) filter (where exists (select 1 from days x where x.player_id = f.player_id and x.d = f.c + 1)) as kept
    from firsts f where f.c between p_today - 8 and p_today - 2
  ),
  d7 as (
    select count(*) as cohort, count(*) filter (where exists (select 1 from days x where x.player_id = f.player_id and x.d = f.c + 7)) as kept
    from firsts f where f.c between p_today - 14 and p_today - 8
  )
  select jsonb_build_object(
    'd1', case when d1.cohort > 0 then round(100.0 * d1.kept / d1.cohort, 1) end, 'd1_cohort', d1.cohort,
    'd7', case when d7.cohort > 0 then round(100.0 * d7.kept / d7.cohort, 1) end, 'd7_cohort', d7.cohort)
  from d1, d7
$$;
