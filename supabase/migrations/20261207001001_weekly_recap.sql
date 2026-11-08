-- R3-10 (admin cascade): the weekly recap card on the admin Metrics page.
--
-- No new client_metrics names: the card is a prompt (lib/prompts/ids.ts `weekly_recap`, trigger `week`), so it
-- records prompt_shown (shown), prompt_accepted (Play today's Daily) and prompt_dismissed (closed), and its share
-- sheet records share with kind 'recap'. All anonymous like the others: no player id, IP or URL.
-- private.admin_weekly_recap(from, to) counts them per GMT day and for the range: wr_shown, wr_shared, wr_played,
-- wr_dismissed. public.svc_admin_metrics is redefined with every existing part (up to 20261207000901, the R3-09
-- streak nudge) plus this one. The recap itself is computed on request from existing tables; nothing new is stored.
-- No data changes; RLS stays forced on client_metrics.
--
-- Rollback:
--   re-run the `create or replace function public.svc_admin_metrics` statement (and its revoke and grant) from
--   supabase/migrations/20261207000901_streak_nudge.sql, then:
--   drop function if exists private.admin_weekly_recap(date, date);
--   delete from supabase_migrations.schema_migrations where version = '20261207001001';

create or replace function private.admin_weekly_recap(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  cm as (
    select (c.created_at at time zone 'utc')::date as d, c.name
    from public.client_metrics c, b
    where c.created_at >= b.lo and c.created_at < b.hi
      and ((c.name in ('prompt_shown', 'prompt_accepted', 'prompt_dismissed') and c.mode = 'weekly_recap')
           or (c.name = 'share' and c.kind = 'recap'))
  ),
  per as (
    select x.d, jsonb_build_object(
      'wr_shown', count(c.d) filter (where c.name = 'prompt_shown'),
      'wr_shared', count(c.d) filter (where c.name = 'share'),
      'wr_played', count(c.d) filter (where c.name = 'prompt_accepted'),
      'wr_dismissed', count(c.d) filter (where c.name = 'prompt_dismissed')) as v
    from (select d from days union all select null::date) x
    left join cm c on x.d is null or c.d = x.d
    group by x.d
  )
  select jsonb_build_object(
    'total', (select v from per where d is null),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;
revoke execute on function private.admin_weekly_recap(date, date) from public, anon, authenticated;

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
  gr as (select private.admin_growth(p_from, p_to) as v),
  sn as (select private.admin_streak_nudge(p_from, p_to) as v),
  wr as (select private.admin_weekly_recap(p_from, p_to) as v)
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
      || coalesce(gr.v -> 'total', '{}'::jsonb)
      || coalesce(sn.v -> 'total', '{}'::jsonb)
      || coalesce(wr.v -> 'total', '{}'::jsonb),
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
          || coalesce(snd.v - 'date', '{}'::jsonb)
          || coalesce(wrd.v - 'date', '{}'::jsonb)
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
      left join jsonb_array_elements(sn.v -> 'days') snd(v) on snd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(wr.v -> 'days') wrd(v) on wrd.v ->> 'date' = md.v ->> 'date'
    ), '[]'::jsonb))
  from m, f, db, pm, p, x, tw, fc, pr, rc, gv, gr, sn, wr
$$;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;
