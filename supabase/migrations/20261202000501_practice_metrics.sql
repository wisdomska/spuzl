-- R2-ADMIN (admin cascade): practice-round completion and drop-off on the admin Metrics page.
--
-- client_metrics accepts practice_start, practice_finish and practice_skip (anonymous like the others: the game id
-- only). GuidedPlay (R2-07, the short first try with free hints) records a start when its board shows, a finish when
-- the board is solved and a skip when the player taps Skip; a start with neither is a drop-off (left the screen).
-- private.admin_practice(from, to) counts them per GMT day and for the range, with a `practice_games` object keyed
-- by game ({started, finished, skipped}) for the per-game breakdown.
-- public.svc_admin_metrics is redefined with every existing part (20261130109901, 20261202000301, 20261202000401)
-- plus this one, and the name check is widened with the full existing list. No data changes; RLS stays forced.
--
-- Rollback:
--   re-run the `create or replace function public.svc_admin_metrics` statement (and its revoke and grant) from
--   supabase/migrations/20261202000401_first_clear_metric.sql, then:
--   drop function if exists private.admin_practice(date, date);
--   delete from public.client_metrics where name in ('practice_start', 'practice_finish', 'practice_skip');
--   alter table public.client_metrics drop constraint if exists client_metrics_name_check;
--   alter table public.client_metrics add constraint client_metrics_name_check
--     check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step',
--                     'duel_created', 'party_first_move', 'prompt_shown', 'prompt_accepted', 'prompt_dismissed', 'daily5_start',
--                     'daily5_complete', 'daily5_share'));
--   delete from supabase_migrations.schema_migrations where version = '20261202000501';

alter table public.client_metrics drop constraint if exists client_metrics_name_check;
alter table public.client_metrics add constraint client_metrics_name_check
  check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step',
                  'duel_created', 'party_first_move', 'prompt_shown', 'prompt_accepted', 'prompt_dismissed', 'daily5_start',
                  'daily5_complete', 'daily5_share', 'practice_start', 'practice_finish', 'practice_skip'));
alter table public.client_metrics enable row level security;
alter table public.client_metrics force row level security;

create or replace function private.admin_practice(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  x as (select d from days union all select null::date),
  cm as (
    select (c.created_at at time zone 'utc')::date as d, c.name, coalesce(c.game_id, 'unknown') as g
    from public.client_metrics c, b
    where c.created_at >= b.lo and c.created_at < b.hi and c.name in ('practice_start', 'practice_finish', 'practice_skip')
  ),
  -- One row per (day, game), plus the whole range as d = null.
  games as (
    select x.d, c.g,
      count(*) filter (where c.name = 'practice_start') as started,
      count(*) filter (where c.name = 'practice_finish') as finished,
      count(*) filter (where c.name = 'practice_skip') as skipped
    from x join cm c on x.d is null or c.d = x.d
    group by x.d, c.g
  ),
  per as (
    select x.d, jsonb_build_object(
      'practice_started', coalesce(sum(g.started), 0),
      'practice_finished', coalesce(sum(g.finished), 0),
      'practice_skipped', coalesce(sum(g.skipped), 0),
      'practice_games', coalesce(
        jsonb_object_agg(g.g, jsonb_build_object('started', g.started, 'finished', g.finished, 'skipped', g.skipped))
          filter (where g.g is not null),
        '{}'::jsonb)) as v
    from x left join games g on g.d is not distinct from x.d
    group by x.d
  )
  select jsonb_build_object(
    'total', (select v from per where d is null),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;
revoke execute on function private.admin_practice(date, date) from public, anon, authenticated;

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
  pr as (select private.admin_practice(p_from, p_to) as v)
  select m.v || jsonb_build_object(
    'total', (m.v -> 'total')
      || coalesce(f.v -> 'total', '{}'::jsonb)
      || coalesce(db.v -> 'total', '{}'::jsonb)
      || coalesce(pm.v -> 'total', '{}'::jsonb)
      || coalesce(p.v -> 'total', '{}'::jsonb)
      || coalesce(x.v -> 'total', '{}'::jsonb)
      || coalesce(tw.v -> 'total', '{}'::jsonb)
      || coalesce(fc.v -> 'total', '{}'::jsonb)
      || coalesce(pr.v -> 'total', '{}'::jsonb),
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
    ), '[]'::jsonb))
  from m, f, db, pm, p, x, tw, fc, pr
$$;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;
