-- R2-ADMIN (admin cascade): D1 and D7 retention as a cohort table, with CSV, on the admin Metrics page.
--
-- Same definition as Live ops (private.admin_retention, 20261103000001), per cohort day instead of one rolling number:
--   cohort  players whose first attempt (any mode) started on that GMT day; test players left out
--   D1      of those, the ones who started an attempt the next GMT day
--   D7      of those, the ones who started an attempt 7 GMT days later
-- A day counts toward D1 (D7) only once that later day is over (before today, GMT); until then its D1 (D7) cohort
-- is 0 and the page shows n/a. The range total adds up the days that count.
-- private.admin_retention_cohorts(from, to) returns, per day and for the range: ret_cohort, ret_d1_cohort,
-- ret_d1_kept, ret_d7_cohort, ret_d7_kept. Read only; no data changes.
-- public.svc_admin_metrics is redefined with every existing part (20261130109901 and 20261202000301 to 0501) plus
-- this one.
--
-- Rollback:
--   re-run the `create or replace function public.svc_admin_metrics` statement (and its revoke and grant) from
--   supabase/migrations/20261202000501_practice_metrics.sql, then:
--   drop function if exists private.admin_retention_cohorts(date, date);
--   delete from supabase_migrations.schema_migrations where version = '20261202000601';

create or replace function private.admin_retention_cohorts(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi,
      (now() at time zone 'utc')::date as today
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  -- Players with an attempt in the range whose first attempt ever is in the range (attempts_player_idx serves both).
  cand as (
    select distinct a.player_id
    from public.attempts a join public.players p on p.id = a.player_id and not coalesce(p.is_test, false), b
    where a.started_at >= b.lo and a.started_at < b.hi
  ),
  firsts as (
    select c.player_id, (select min(a.started_at) from public.attempts a where a.player_id = c.player_id) as first_at
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
              and a.started_at >= (c.d + 1)::timestamp at time zone 'utc' and a.started_at < (c.d + 2)::timestamp at time zone 'utc') as d1,
      exists (select 1 from public.attempts a where a.player_id = c.player_id
              and a.started_at >= (c.d + 7)::timestamp at time zone 'utc' and a.started_at < (c.d + 8)::timestamp at time zone 'utc') as d7
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
  rc as (select private.admin_retention_cohorts(p_from, p_to) as v)
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
      || coalesce(rc.v -> 'total', '{}'::jsonb),
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
    ), '[]'::jsonb))
  from m, f, db, pm, p, x, tw, fc, pr, rc
$$;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;
