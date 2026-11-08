-- Removes the R2-P5 school and campus leagues (20261204000601) and their school_join metric (20261204000701).
-- The feature was never switched on: no school, player or metric row uses it. The older School Cup (class codes,
-- schools table, admin Schools page) is untouched.
--   public.svc_school_league / private.school_league: dropped.
--   public.schools.kind, public.schools.updated_at, public.players.school_set_at: dropped.
--   schools_verified_name_idx (the league's school search): dropped.
--   client_metrics: school_join rows deleted and the name removed from the check; private.admin_growth no longer
--   counts gr_school_joins (svc_admin_metrics merges whatever it returns, so it is not redefined).
-- RLS stays forced.
--
-- Rollback: re-run supabase/migrations/20261204000601_school_leagues.sql and the client_metrics check and
--   private.admin_growth from supabase/migrations/20261204000701_growth_metrics.sql, then
--   delete from supabase_migrations.schema_migrations where version = '20261206000101';

drop function if exists public.svc_school_league(date, text, integer);
drop function if exists private.school_league(date, text, integer);
drop index if exists public.schools_verified_name_idx;
alter table public.players drop column if exists school_set_at;
alter table public.schools drop column if exists updated_at, drop column if exists kind;

delete from public.client_metrics where name = 'school_join';
alter table public.client_metrics drop constraint if exists client_metrics_name_check;
alter table public.client_metrics add constraint client_metrics_name_check
  check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step',
                  'duel_created', 'party_first_move', 'prompt_shown', 'prompt_accepted', 'prompt_dismissed', 'daily5_start',
                  'daily5_complete', 'daily5_share', 'practice_start', 'practice_finish', 'practice_skip', 'game_over',
                  'party_tv_view', 'streak_shield'));
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
      and c.name in ('party_tv_view', 'streak_shield')
  ),
  per as (
    select x.d, jsonb_build_object(
      'gr_tv_views', count(c.d) filter (where c.name = 'party_tv_view'),
      'gr_shields', count(c.d) filter (where c.name = 'streak_shield')) as v
    from (select d from days union all select null::date) x
    left join cm c on x.d is null or c.d = x.d
    group by x.d
  )
  select jsonb_build_object(
    'total', (select v from per where d is null),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;
revoke execute on function private.admin_growth(date, date) from public, anon, authenticated;
