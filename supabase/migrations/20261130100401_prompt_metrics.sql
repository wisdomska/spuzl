-- R2-04 prompt timing: prompt_shown / prompt_accepted / prompt_dismissed in the admin Metrics page.
--
-- public.client_metrics accepts three more anonymous names (still no player id, IP or URL):
--   prompt_shown, prompt_accepted, prompt_dismissed
--     mode = the prompt (save_streak, alerts, low_data, event), kind = its trigger (lib/prompts/ids.ts)
--
-- private.admin_prompt_metrics(from, to) counts them per GMT day and for the range: totals (prompt_shown,
-- prompt_accepted, prompt_dismissed) and a `prompts` object keyed "<prompt>.<trigger>" with {shown, accepted,
-- dismissed}. public.svc_admin_metrics merges it with the other two parts, so the API shape only grows.
-- RLS stays enabled and forced on client_metrics; existing rows are untouched.
--
-- Builds on 20261130100301 (R2-03): svc_admin_metrics keeps merging private.admin_party_metrics as well.
--
-- Rollback (restores 20261130100301's svc_admin_metrics): re-run the `create or replace function
-- public.svc_admin_metrics` statement from supabase/migrations/20261130100301_party_first_move_metric.sql, then:
--   revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
--   grant execute on function public.svc_admin_metrics(date, date) to service_role;
--   drop function if exists private.admin_prompt_metrics(date, date);
--   delete from public.client_metrics where name in ('prompt_shown', 'prompt_accepted', 'prompt_dismissed');
--   alter table public.client_metrics drop constraint if exists client_metrics_name_check;
--   alter table public.client_metrics add constraint client_metrics_name_check
--     check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step',
--                     'party_first_move'));
--   delete from supabase_migrations.schema_migrations where version = '20261130100401';

alter table public.client_metrics drop constraint if exists client_metrics_name_check;
alter table public.client_metrics add constraint client_metrics_name_check
  check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step',
                  'party_first_move', 'prompt_shown', 'prompt_accepted', 'prompt_dismissed'));
alter table public.client_metrics enable row level security;
alter table public.client_metrics force row level security;

create or replace function private.admin_prompt_metrics(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  x as (select d from days union all select null::date),
  cm as (
    select (c.created_at at time zone 'utc')::date as d, c.name, c.mode || '.' || c.kind as k
    from public.client_metrics c, b
    where c.created_at >= b.lo and c.created_at < b.hi
      and c.name in ('prompt_shown', 'prompt_accepted', 'prompt_dismissed')
      and c.mode is not null and c.kind is not null
  ),
  -- One row per (day, prompt.trigger), plus the whole range as d = null.
  pairs as (
    select x.d, c.k,
      count(*) filter (where c.name = 'prompt_shown') as shown,
      count(*) filter (where c.name = 'prompt_accepted') as accepted,
      count(*) filter (where c.name = 'prompt_dismissed') as dismissed
    from x join cm c on x.d is null or c.d = x.d
    group by x.d, c.k
  ),
  per as (
    select x.d, jsonb_build_object(
      'prompt_shown', coalesce(sum(p.shown), 0),
      'prompt_accepted', coalesce(sum(p.accepted), 0),
      'prompt_dismissed', coalesce(sum(p.dismissed), 0),
      'prompts', coalesce(
        jsonb_object_agg(p.k, jsonb_build_object('shown', p.shown, 'accepted', p.accepted, 'dismissed', p.dismissed))
          filter (where p.k is not null),
        '{}'::jsonb)) as v
    from x left join pairs p on p.d is not distinct from x.d
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
  pm as (select private.admin_party_metrics(p_from, p_to) as v),
  p as (select private.admin_prompt_metrics(p_from, p_to) as v)
  select m.v || jsonb_build_object(
    'total', (m.v -> 'total') || (f.v -> 'total') || (pm.v -> 'total') || (p.v -> 'total'),
    'days', coalesce((
      select jsonb_agg(md.v || coalesce(fd.v - 'date', '{}'::jsonb) || coalesce(pmd.v - 'date', '{}'::jsonb)
        || coalesce(pd.v - 'date', '{}'::jsonb) order by md.i)
      from jsonb_array_elements(m.v -> 'days') with ordinality md(v, i)
      left join jsonb_array_elements(f.v -> 'days') fd(v) on fd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(pm.v -> 'days') pmd(v) on pmd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(p.v -> 'days') pd(v) on pd.v ->> 'date' = md.v ->> 'date'
    ), '[]'::jsonb))
  from m, f, pm, p
$$;

revoke execute on function private.admin_prompt_metrics(date, date) from public, anon, authenticated;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;
