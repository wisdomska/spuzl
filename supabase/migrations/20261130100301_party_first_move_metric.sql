-- R2-03 Admin Metrics: Party start-to-first-move.
--
-- public.client_metrics accepts one more anonymous name (still no player id, IP or URL):
--   party_first_move  value_ms = ms from a Party game's real start (the end of its 3-2-1-SPUZL! countdown) to a
--                     racer's first move; game_id = the round's game; mode = 'race'
--
-- private.admin_party_metrics(from, to) gives its count, p50 and p95 per GMT day and for the range (same shape as
-- private.admin_metrics), and public.svc_admin_metrics now merges it too, so the API and its callers are unchanged
-- (rows gain party_first_move_n, party_first_move_p50, party_first_move_p95). private.admin_metrics and
-- private.admin_client_funnel are not touched. RLS stays enabled and forced on client_metrics; nothing is granted to
-- clients (the table is written only by POST /api/v1/metrics with the service role).
--
-- Rollback (restores 20261110000001's svc_admin_metrics):
--   create or replace function public.svc_admin_metrics(p_from date, p_to date) returns jsonb
--   language sql stable security definer set search_path = '' as $$
--     with m as (select private.admin_metrics(p_from, p_to) as v),
--     f as (select private.admin_client_funnel(p_from, p_to) as v)
--     select m.v || jsonb_build_object(
--       'total', (m.v -> 'total') || (f.v -> 'total'),
--       'days', coalesce((
--         select jsonb_agg(md.v || coalesce(fd.v - 'date', '{}'::jsonb) order by md.i)
--         from jsonb_array_elements(m.v -> 'days') with ordinality md(v, i)
--         left join jsonb_array_elements(f.v -> 'days') fd(v) on fd.v ->> 'date' = md.v ->> 'date'
--       ), '[]'::jsonb))
--     from m, f
--   $$;
--   revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
--   grant execute on function public.svc_admin_metrics(date, date) to service_role;
--   drop function if exists private.admin_party_metrics(date, date);
--   delete from public.client_metrics where name = 'party_first_move';
--   alter table public.client_metrics drop constraint if exists client_metrics_name_check;
--   alter table public.client_metrics add constraint client_metrics_name_check
--     check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step'));
--   delete from supabase_migrations.schema_migrations where version = '20261130100301';

alter table public.client_metrics drop constraint if exists client_metrics_name_check;
alter table public.client_metrics add constraint client_metrics_name_check
  check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step', 'party_first_move'));
alter table public.client_metrics enable row level security;
alter table public.client_metrics force row level security;

create or replace function private.admin_party_metrics(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  cm as (
    select (c.created_at at time zone 'utc')::date as d, c.value_ms
    from public.client_metrics c, b
    where c.created_at >= b.lo and c.created_at < b.hi and c.name = 'party_first_move' and c.value_ms is not null
  ),
  -- One row per day, plus the whole range as d = null.
  per as (
    select x.d, jsonb_build_object(
      'party_first_move_n', count(c.value_ms),
      'party_first_move_p50', round(percentile_cont(0.5) within group (order by c.value_ms)),
      'party_first_move_p95', round(percentile_cont(0.95) within group (order by c.value_ms))) as v
    from (select d from days union all select null::date) x
    left join cm c on x.d is null or c.d = x.d
    group by x.d
  )
  select jsonb_build_object(
    'total', (select v from per where d is null),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;

create or replace function public.svc_admin_metrics(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with m as (select private.admin_metrics(p_from, p_to) as v),
  f as (select private.admin_client_funnel(p_from, p_to) as v),
  pm as (select private.admin_party_metrics(p_from, p_to) as v)
  select m.v || jsonb_build_object(
    'total', (m.v -> 'total') || (f.v -> 'total') || (pm.v -> 'total'),
    'days', coalesce((
      select jsonb_agg(md.v || coalesce(fd.v - 'date', '{}'::jsonb) || coalesce(pd.v - 'date', '{}'::jsonb) order by md.i)
      from jsonb_array_elements(m.v -> 'days') with ordinality md(v, i)
      left join jsonb_array_elements(f.v -> 'days') fd(v) on fd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(pm.v -> 'days') pd(v) on pd.v ->> 'date' = md.v ->> 'date'
    ), '[]'::jsonb))
  from m, f, pm
$$;

revoke execute on function private.admin_party_metrics(date, date) from public, anon, authenticated;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;
