-- R2-ADMIN (admin cascade): landing to first clear on the admin Metrics page.
--
-- private.admin_first_clear(from, to): for the players whose profile was created on each GMT day in the range (the
-- landing: a guest profile is made on the first visit's Welcome), how many have cleared a board since (any mode but
-- the onboarding tutorial, so a Daily, free play, a level, the Daily Five, a Duel or a Party round), and p50 and p95
-- of the time from profile creation to that first clear. Test players are left out. The range total pools every
-- day's cohort. Read only; no data changes.
-- public.svc_admin_metrics is redefined with every existing part (20261130109901, 20261202000301) plus this one.
--
-- Rollback:
--   re-run the `create or replace function public.svc_admin_metrics` statement (and its revoke and grant) from
--   supabase/migrations/20261202000301_tap_warmth_metric.sql, then:
--   drop function if exists private.admin_first_clear(date, date);
--   delete from supabase_migrations.schema_migrations where version = '20261202000401';

create or replace function private.admin_first_clear(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  cohort as (
    select (p.created_at at time zone 'utc')::date as d, p.created_at,
      (select min(a.finished_at) from public.attempts a
        where a.player_id = p.id and a.status = 'cleared' and a.mode <> 'tutorial' and a.finished_at >= p.created_at) as first_clear
    from public.players p, b
    where not coalesce(p.is_test, false) and p.created_at >= b.lo and p.created_at < b.hi
  ),
  t as (
    select d, round(extract(epoch from first_clear - created_at) * 1000)::bigint as ms from cohort where first_clear is not null
  ),
  pc as (
    select d, count(*) as n,
      round(percentile_cont(0.5) within group (order by ms))::bigint as p50,
      round(percentile_cont(0.95) within group (order by ms))::bigint as p95
    from t group by grouping sets ((d), ())
  ),
  per as (
    select x.d, jsonb_build_object(
      'fc_cohort', (select count(*) from cohort c where x.d is null or c.d = x.d),
      'fc_cleared', coalesce(q.n, 0), 'fc_p50', q.p50, 'fc_p95', q.p95) as v
    from (select d from days union all select null::date) x
    left join pc q on q.d is not distinct from x.d
  )
  select jsonb_build_object(
    'total', (select v from per where d is null),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;
revoke execute on function private.admin_first_clear(date, date) from public, anon, authenticated;

create or replace function public.svc_admin_metrics(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with m as (select private.admin_metrics(p_from, p_to) as v),
  f as (select private.admin_client_funnel(p_from, p_to) as v),
  db as (select private.admin_duel_bands(p_from, p_to) as v),
  pm as (select private.admin_party_metrics(p_from, p_to) as v),
  p as (select private.admin_prompt_metrics(p_from, p_to) as v),
  x as (select private.admin_daily_five(p_from, p_to) as v),
  tw as (select private.admin_tap_warmth(p_from, p_to) as v),
  fc as (select private.admin_first_clear(p_from, p_to) as v)
  select m.v || jsonb_build_object(
    'total', (m.v -> 'total')
      || coalesce(f.v -> 'total', '{}'::jsonb)
      || coalesce(db.v -> 'total', '{}'::jsonb)
      || coalesce(pm.v -> 'total', '{}'::jsonb)
      || coalesce(p.v -> 'total', '{}'::jsonb)
      || coalesce(x.v -> 'total', '{}'::jsonb)
      || coalesce(tw.v -> 'total', '{}'::jsonb)
      || coalesce(fc.v -> 'total', '{}'::jsonb),
    'days', coalesce((
      select jsonb_agg(md.v
          || coalesce(fd.v - 'date', '{}'::jsonb)
          || coalesce(dbd.v - 'date', '{}'::jsonb)
          || coalesce(pmd.v - 'date', '{}'::jsonb)
          || coalesce(pd.v - 'date', '{}'::jsonb)
          || coalesce(xd.v - 'date', '{}'::jsonb)
          || coalesce(twd.v - 'date', '{}'::jsonb)
          || coalesce(fcd.v - 'date', '{}'::jsonb)
        order by md.i)
      from jsonb_array_elements(m.v -> 'days') with ordinality md(v, i)
      left join jsonb_array_elements(f.v -> 'days') fd(v) on fd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(db.v -> 'days') dbd(v) on dbd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(pm.v -> 'days') pmd(v) on pmd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(p.v -> 'days') pd(v) on pd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(x.v -> 'days') xd(v) on xd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(tw.v -> 'days') twd(v) on twd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(fc.v -> 'days') fcd(v) on fcd.v ->> 'date' = md.v ->> 'date'
    ), '[]'::jsonb))
  from m, f, db, pm, p, x, tw, fc
$$;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;
