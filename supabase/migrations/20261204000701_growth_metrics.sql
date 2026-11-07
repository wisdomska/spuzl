-- R2-P5 (admin cascade): Party TV views, sign-in streak shields and school league joins on the admin Metrics page.
--
-- client_metrics accepts party_tv_view (the big-screen view loaded a room), streak_shield (a guest who signed in
-- from "Save your streak" got the free Streak Freeze) and school_join (a player picked their school or campus;
-- kind 'school' or 'campus'). Anonymous like the others: no player id, IP or URL.
-- private.admin_growth(from, to) counts them per GMT day and for the range: gr_tv_views, gr_shields, gr_school_joins.
-- public.svc_admin_metrics is redefined with every existing part (up to 20261202000701) plus this one, and the name
-- check is widened with the full existing list. No data changes; RLS stays forced.
--
-- Rollback:
--   re-run the `create or replace function public.svc_admin_metrics` statement (and its revoke and grant) from
--   supabase/migrations/20261202000701_game_over_metric.sql, then:
--   drop function if exists private.admin_growth(date, date);
--   delete from public.client_metrics where name in ('party_tv_view', 'streak_shield', 'school_join');
--   alter table public.client_metrics drop constraint if exists client_metrics_name_check;
--   alter table public.client_metrics add constraint client_metrics_name_check
--     check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step',
--                     'duel_created', 'party_first_move', 'prompt_shown', 'prompt_accepted', 'prompt_dismissed', 'daily5_start',
                    'daily5_complete', 'daily5_share', 'practice_start', 'practice_finish', 'practice_skip', 'game_over'));
--   delete from supabase_migrations.schema_migrations where version = '20261204000701';

alter table public.client_metrics drop constraint if exists client_metrics_name_check;
alter table public.client_metrics add constraint client_metrics_name_check
  check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step',
                  'duel_created', 'party_first_move', 'prompt_shown', 'prompt_accepted', 'prompt_dismissed', 'daily5_start',
                  'daily5_complete', 'daily5_share', 'practice_start', 'practice_finish', 'practice_skip', 'game_over',
                  'party_tv_view', 'streak_shield', 'school_join'));
alter table public.client_metrics enable row level security;
alter table public.client_metrics force row level security;

create or replace function private.admin_growth(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  cm as (
    select (c.created_at at time zone 'utc')::date as d, c.name
    from public.client_metrics c, b
    where c.created_at >= b.lo and c.created_at < b.hi
      and c.name in ('party_tv_view', 'streak_shield', 'school_join')
  ),
  per as (
    select x.d, jsonb_build_object(
      'gr_tv_views', count(c.d) filter (where c.name = 'party_tv_view'),
      'gr_shields', count(c.d) filter (where c.name = 'streak_shield'),
      'gr_school_joins', count(c.d) filter (where c.name = 'school_join')) as v
    from (select d from days union all select null::date) x
    left join cm c on x.d is null or c.d = x.d
    group by x.d
  )
  select jsonb_build_object(
    'total', (select v from per where d is null),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;
revoke execute on function private.admin_growth(date, date) from public, anon, authenticated;

create or replace function public.svc_admin_metrics` statement (and its revoke and grant) from
--   supabase/migrations/20261202000601_retention_cohorts_metric.sql, then:
--   drop function if exists private.admin_game_over(date, date);
--   delete from public.client_metrics where name = 'game_over';
--   alter table public.client_metrics drop constraint if exists client_metrics_name_check;
--   alter table public.client_metrics add constraint client_metrics_name_check
--     check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step',
--                     'duel_created', 'party_first_move', 'prompt_shown', 'prompt_accepted', 'prompt_dismissed', 'daily5_start',
--                     'daily5_complete', 'daily5_share', 'practice_start', 'practice_finish', 'practice_skip'));
--   delete from supabase_migrations.schema_migrations where version = '20261202000701';

alter table public.client_metrics drop constraint if exists client_metrics_name_check;
alter table public.client_metrics add constraint client_metrics_name_check
  check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step',
                  'duel_created', 'party_first_move', 'prompt_shown', 'prompt_accepted', 'prompt_dismissed', 'daily5_start',
                  'daily5_complete', 'daily5_share', 'practice_start', 'practice_finish', 'practice_skip', 'game_over'));
alter table public.client_metrics enable row level security;
alter table public.client_metrics force row level security;

create or replace function private.admin_game_over(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  cm as (
    select (c.created_at at time zone 'utc')::date as d, c.mode, c.kind
    from public.client_metrics c, b
    where c.created_at >= b.lo and c.created_at < b.hi and c.name = 'game_over'
      and c.mode in ('bay', 'bot') and c.kind in ('won', 'lost', 'draw')
  ),
  per as (
    select x.d, jsonb_build_object(
      'go_bay_won', count(c.d) filter (where c.mode = 'bay' and c.kind = 'won'),
      'go_bay_lost', count(c.d) filter (where c.mode = 'bay' and c.kind = 'lost'),
      'go_bay_draw', count(c.d) filter (where c.mode = 'bay' and c.kind = 'draw'),
      'go_bot_won', count(c.d) filter (where c.mode = 'bot' and c.kind = 'won'),
      'go_bot_lost', count(c.d) filter (where c.mode = 'bot' and c.kind = 'lost'),
      'go_bot_draw', count(c.d) filter (where c.mode = 'bot' and c.kind = 'draw')) as v
    from (select d from days union all select null::date) x
    left join cm c on x.d is null or c.d = x.d
    group by x.d
  )
  select jsonb_build_object(
    'total', (select v from per where d is null),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;
revoke execute on function private.admin_game_over(date, date) from public, anon, authenticated;

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
  gr as (select private.admin_growth(p_from, p_to) as v)
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
      || coalesce(gr.v -> 'total', '{}'::jsonb),
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
    ), '[]'::jsonb))
  from m, f, db, pm, p, x, tw, fc, pr, rc, gv, gr
$$;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;
