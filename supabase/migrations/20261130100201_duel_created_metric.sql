-- R2-02: duel creation by age band, for the admin Metrics page.
--
-- public.client_metrics accepts one more name, written only by the server (never by POST /api/v1/metrics):
--   duel_created  kind = friend (Challenge a friend) or quick (a Quick Match pairing); band = the creator's age band
-- The new band column holds an age band only ('13-15', '16-17', '18+'), never a birth date or player id, so the
-- table stays anonymous. Existing rows keep band null.
--
-- private.admin_duel_bands(from, to) counts them per GMT day and for the range (same shape as
-- private.admin_client_funnel), and public.svc_admin_metrics merges it in, so the API and its callers are unchanged.
-- RLS stays enabled and forced on client_metrics; nobody but the service role reads or writes it.
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
--   drop function if exists private.admin_duel_bands(date, date);
--   delete from public.client_metrics where name = 'duel_created';
--   alter table public.client_metrics drop constraint if exists client_metrics_name_check;
--   alter table public.client_metrics add constraint client_metrics_name_check
--     check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step'));
--   alter table public.client_metrics drop column if exists band;
--   delete from supabase_migrations.schema_migrations where version = '20261130100201';

alter table public.client_metrics add column if not exists band text check (band in ('13-15', '16-17', '18+'));
alter table public.client_metrics drop constraint if exists client_metrics_name_check;
alter table public.client_metrics add constraint client_metrics_name_check
  check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step', 'duel_created'));
alter table public.client_metrics enable row level security;
alter table public.client_metrics force row level security;

create or replace function private.admin_duel_bands(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  cm as (
    select (c.created_at at time zone 'utc')::date as d, c.kind, c.band
    from public.client_metrics c, b
    where c.created_at >= b.lo and c.created_at < b.hi and c.name = 'duel_created'
  ),
  -- One row per day, plus the whole range as d = null.
  per as (
    select x.d, jsonb_build_object(
      'duels_friend_1315', count(c.d) filter (where c.kind = 'friend' and c.band = '13-15'),
      'duels_friend_1617', count(c.d) filter (where c.kind = 'friend' and c.band = '16-17'),
      'duels_friend_18', count(c.d) filter (where c.kind = 'friend' and c.band = '18+'),
      'duels_quick_1315', count(c.d) filter (where c.kind = 'quick' and c.band = '13-15'),
      'duels_quick_1617', count(c.d) filter (where c.kind = 'quick' and c.band = '16-17'),
      'duels_quick_18', count(c.d) filter (where c.kind = 'quick' and c.band = '18+')) as v
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
  db as (select private.admin_duel_bands(p_from, p_to) as v)
  select m.v || jsonb_build_object(
    'total', (m.v -> 'total') || (f.v -> 'total') || (db.v -> 'total'),
    'days', coalesce((
      select jsonb_agg(md.v || coalesce(fd.v - 'date', '{}'::jsonb) || coalesce(dd.v - 'date', '{}'::jsonb) order by md.i)
      from jsonb_array_elements(m.v -> 'days') with ordinality md(v, i)
      left join jsonb_array_elements(f.v -> 'days') fd(v) on fd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(db.v -> 'days') dd(v) on dd.v ->> 'date' = md.v ->> 'date'
    ), '[]'::jsonb))
  from m, f, db
$$;

revoke execute on function private.admin_duel_bands(date, date) from public, anon, authenticated;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;
