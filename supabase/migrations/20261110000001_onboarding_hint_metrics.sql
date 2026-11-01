-- Admin Metrics: first-party onboarding funnel and hint request/use counts.
--
-- public.client_metrics accepts three more anonymous names (still no player id, IP or URL):
--   onboarding_step  kind = the welcome step (hello, signin, age, too_young, start, tutorial, nickname) or "home"
--                    when a new player first reaches Home (lib/analytics/onboarding.ts)
--   hint_request     every tap on Hint; kind = confirm (the first-hint confirm showed) or direct
--   hint_use         every go-ahead (direct, or Confirm on the sheet); cancels = requests minus uses
-- hint_cancel stays accepted for clients still on the old build.
--
-- private.admin_client_funnel(from, to) counts them per GMT day and for the range (same shape as
-- private.admin_metrics), and public.svc_admin_metrics merges both, so the API and its callers are unchanged.
-- private.admin_metrics itself is not touched. RLS stays enabled and forced on client_metrics.
--
-- Rollback:
--   create or replace function public.svc_admin_metrics(p_from date, p_to date) returns jsonb
--     language sql stable security definer set search_path = '' as $$ select private.admin_metrics(p_from, p_to) $$;
--   revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
--   grant execute on function public.svc_admin_metrics(date, date) to service_role;
--   drop function if exists private.admin_client_funnel(date, date);
--   delete from public.client_metrics where name in ('onboarding_step', 'hint_request', 'hint_use');
--   alter table public.client_metrics drop constraint if exists client_metrics_name_check;
--   alter table public.client_metrics add constraint client_metrics_name_check
--     check (name in ('tap_to_board', 'hint_cancel', 'share'));
--   delete from supabase_migrations.schema_migrations where version = '20261110000001';

alter table public.client_metrics drop constraint if exists client_metrics_name_check;
alter table public.client_metrics add constraint client_metrics_name_check
  check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step'));
alter table public.client_metrics enable row level security;
alter table public.client_metrics force row level security;

create or replace function private.admin_client_funnel(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  cm as (
    select (c.created_at at time zone 'utc')::date as d, c.name, c.kind
    from public.client_metrics c, b
    where c.created_at >= b.lo and c.created_at < b.hi and c.name in ('onboarding_step', 'hint_request', 'hint_use')
  ),
  -- One row per day, plus the whole range as d = null.
  per as (
    select x.d, jsonb_build_object(
      'onboarding_hello', count(c.d) filter (where c.name = 'onboarding_step' and c.kind = 'hello'),
      'onboarding_signin', count(c.d) filter (where c.name = 'onboarding_step' and c.kind = 'signin'),
      'onboarding_age', count(c.d) filter (where c.name = 'onboarding_step' and c.kind = 'age'),
      'onboarding_too_young', count(c.d) filter (where c.name = 'onboarding_step' and c.kind = 'too_young'),
      'onboarding_start', count(c.d) filter (where c.name = 'onboarding_step' and c.kind = 'start'),
      'onboarding_tutorial', count(c.d) filter (where c.name = 'onboarding_step' and c.kind = 'tutorial'),
      'onboarding_nickname', count(c.d) filter (where c.name = 'onboarding_step' and c.kind = 'nickname'),
      'onboarding_home', count(c.d) filter (where c.name = 'onboarding_step' and c.kind = 'home'),
      'hint_requests', count(c.d) filter (where c.name = 'hint_request'),
      'hint_uses', count(c.d) filter (where c.name = 'hint_use')) as v
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
  f as (select private.admin_client_funnel(p_from, p_to) as v)
  select m.v || jsonb_build_object(
    'total', (m.v -> 'total') || (f.v -> 'total'),
    'days', coalesce((
      select jsonb_agg(md.v || coalesce(fd.v - 'date', '{}'::jsonb) order by md.i)
      from jsonb_array_elements(m.v -> 'days') with ordinality md(v, i)
      left join jsonb_array_elements(f.v -> 'days') fd(v) on fd.v ->> 'date' = md.v ->> 'date'
    ), '[]'::jsonb))
  from m, f
$$;

revoke execute on function private.admin_client_funnel(date, date) from public, anon, authenticated;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;
