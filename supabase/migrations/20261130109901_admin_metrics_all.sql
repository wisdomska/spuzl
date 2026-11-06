-- Round 2: one admin metrics function with every part, after the R2 tickets that each extended it on their own.
--
-- R2-02 (duel_created by age band), R2-03 (party_first_move), R2-04 (prompt_*) and R2-05 (daily5_*) each widened
-- public.client_metrics' name check and redefined public.svc_admin_metrics with only their own part. Applied in
-- order, the last one wins, so this migration (after all of them) sets:
--   - the name check to every first-party and server-recorded name;
--   - svc_admin_metrics to merge private.admin_metrics, admin_client_funnel, admin_duel_bands, admin_party_metrics,
--     admin_prompt_metrics and admin_daily_five, per GMT day and for the range.
-- No data changes. RLS stays enabled and forced on client_metrics; svc_admin_metrics stays service-role only.
--
-- Rollback (back to 20261130100501's definition): re-run the `alter table public.client_metrics ... check` and the
-- `create or replace function public.svc_admin_metrics` statements from
-- supabase/migrations/20261130100501_daily_five.sql (rows with names that check no longer allows must be deleted
-- first), then:
--   delete from supabase_migrations.schema_migrations where version = '20261130109901';

alter table public.client_metrics drop constraint if exists client_metrics_name_check;
alter table public.client_metrics add constraint client_metrics_name_check
  check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step',
                  'duel_created', 'party_first_move', 'prompt_shown', 'prompt_accepted', 'prompt_dismissed',
                  'daily5_start', 'daily5_complete', 'daily5_share'));
alter table public.client_metrics enable row level security;
alter table public.client_metrics force row level security;

create or replace function public.svc_admin_metrics(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with m as (select private.admin_metrics(p_from, p_to) as v),
  f as (select private.admin_client_funnel(p_from, p_to) as v),
  db as (select private.admin_duel_bands(p_from, p_to) as v),
  pm as (select private.admin_party_metrics(p_from, p_to) as v),
  p as (select private.admin_prompt_metrics(p_from, p_to) as v),
  x as (select private.admin_daily_five(p_from, p_to) as v)
  select m.v || jsonb_build_object(
    'total', (m.v -> 'total') || coalesce(f.v -> 'total', '{}'::jsonb) || coalesce(db.v -> 'total', '{}'::jsonb)
      || coalesce(pm.v -> 'total', '{}'::jsonb) || coalesce(p.v -> 'total', '{}'::jsonb)
      || coalesce(x.v -> 'total', '{}'::jsonb),
    'days', coalesce((
      select jsonb_agg(md.v
          || coalesce(fd.v - 'date', '{}'::jsonb)
          || coalesce(dbd.v - 'date', '{}'::jsonb)
          || coalesce(pmd.v - 'date', '{}'::jsonb)
          || coalesce(pd.v - 'date', '{}'::jsonb)
          || coalesce(xd.v - 'date', '{}'::jsonb)
        order by md.i)
      from jsonb_array_elements(m.v -> 'days') with ordinality md(v, i)
      left join jsonb_array_elements(f.v -> 'days') fd(v) on fd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(db.v -> 'days') dbd(v) on dbd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(pm.v -> 'days') pmd(v) on pmd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(p.v -> 'days') pd(v) on pd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(x.v -> 'days') xd(v) on xd.v ->> 'date' = md.v ->> 'date'
    ), '[]'::jsonb))
  from m, f, db, pm, p, x
$$;

revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;
