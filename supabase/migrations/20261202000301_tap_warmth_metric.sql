-- R2-ADMIN (admin cascade): cold and warm tap-to-board on the admin Metrics page.
--
-- client_metrics.warm  tap_to_board only: false for the first board of the page session (the game's code and data
--                      were not loaded yet), true for every later board in the same page. A boolean, nothing that
--                      identifies anyone; NULL on older rows and on every other metric.
-- private.admin_tap_warmth(from, to) gives, per GMT day and for the range, count, p50 and p95 for:
--   cold = page opened straight on Play (kind 'load') or the first tapped board of the page session (warm = false)
--   warm = later tapped boards in the same page session (kind 'tap', warm = true)
-- Taps from older clients (warm is NULL) stay in the existing Tap to board card and out of this split.
-- public.svc_admin_metrics is redefined with every existing part (20261130109901) plus this one.
-- No data changes. RLS stays enabled and forced; both functions stay service-role only.
--
-- Rollback:
--   re-run the `create or replace function public.svc_admin_metrics` statement (and its revoke and grant) from
--   supabase/migrations/20261130109901_admin_metrics_all.sql, then:
--   drop function if exists private.admin_tap_warmth(date, date);
--   alter table public.client_metrics drop column if exists warm;
--   delete from supabase_migrations.schema_migrations where version = '20261202000301';

alter table public.client_metrics add column if not exists warm boolean;
comment on column public.client_metrics.warm is
  'tap_to_board only: false = first board of the page session (cold), true = a later board (warm); NULL otherwise';
alter table public.client_metrics enable row level security;
alter table public.client_metrics force row level security;

create or replace function private.admin_tap_warmth(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  cm as (
    select (c.created_at at time zone 'utc')::date as d,
      case when c.kind = 'load' or (c.kind = 'tap' and c.warm = false) then 'cold'
           when c.kind = 'tap' and c.warm then 'warm' end as k,
      c.value_ms
    from public.client_metrics c, b
    where c.created_at >= b.lo and c.created_at < b.hi and c.name = 'tap_to_board' and c.value_ms is not null
  ),
  -- One row per day and kind, plus the range as d = null (grouping sets keep the percentiles exact).
  pc as (
    select d, k, count(*) as n,
      round(percentile_cont(0.5) within group (order by value_ms))::integer as p50,
      round(percentile_cont(0.95) within group (order by value_ms))::integer as p95
    from cm where k is not null
    group by grouping sets ((d, k), (k))
  ),
  per as (
    select x.d, jsonb_build_object(
      'cold_n', coalesce(c.n, 0), 'cold_p50', c.p50, 'cold_p95', c.p95,
      'warm_n', coalesce(w.n, 0), 'warm_p50', w.p50, 'warm_p95', w.p95) as v
    from (select d from days union all select null::date) x
    left join pc c on c.k = 'cold' and c.d is not distinct from x.d
    left join pc w on w.k = 'warm' and w.d is not distinct from x.d
  )
  select jsonb_build_object(
    'total', (select v from per where d is null),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;
revoke execute on function private.admin_tap_warmth(date, date) from public, anon, authenticated;

create or replace function public.svc_admin_metrics(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with m as (select private.admin_metrics(p_from, p_to) as v),
  f as (select private.admin_client_funnel(p_from, p_to) as v),
  db as (select private.admin_duel_bands(p_from, p_to) as v),
  pm as (select private.admin_party_metrics(p_from, p_to) as v),
  p as (select private.admin_prompt_metrics(p_from, p_to) as v),
  x as (select private.admin_daily_five(p_from, p_to) as v),
  tw as (select private.admin_tap_warmth(p_from, p_to) as v)
  select m.v || jsonb_build_object(
    'total', (m.v -> 'total')
      || coalesce(f.v -> 'total', '{}'::jsonb)
      || coalesce(db.v -> 'total', '{}'::jsonb)
      || coalesce(pm.v -> 'total', '{}'::jsonb)
      || coalesce(p.v -> 'total', '{}'::jsonb)
      || coalesce(x.v -> 'total', '{}'::jsonb)
      || coalesce(tw.v -> 'total', '{}'::jsonb),
    'days', coalesce((
      select jsonb_agg(md.v
          || coalesce(fd.v - 'date', '{}'::jsonb)
          || coalesce(dbd.v - 'date', '{}'::jsonb)
          || coalesce(pmd.v - 'date', '{}'::jsonb)
          || coalesce(pd.v - 'date', '{}'::jsonb)
          || coalesce(xd.v - 'date', '{}'::jsonb)
          || coalesce(twd.v - 'date', '{}'::jsonb)
        order by md.i)
      from jsonb_array_elements(m.v -> 'days') with ordinality md(v, i)
      left join jsonb_array_elements(f.v -> 'days') fd(v) on fd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(db.v -> 'days') dbd(v) on dbd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(pm.v -> 'days') pmd(v) on pmd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(p.v -> 'days') pd(v) on pd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(x.v -> 'days') xd(v) on xd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(tw.v -> 'days') twd(v) on twd.v ->> 'date' = md.v ->> 'date'
    ), '[]'::jsonb))
  from m, f, db, pm, p, x, tw
$$;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;
