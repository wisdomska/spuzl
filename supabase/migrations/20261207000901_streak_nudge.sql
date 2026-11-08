-- R3-09: streak-at-risk nudge. An evening push for players with alerts on whose streak (2+ days, admin
-- "streakNudge.minStreak") would end at midnight GMT because they have not cleared a board today.
--
-- public.alert_prefs: one row per player who changed an alert switch (Settings > Alerts). No row = defaults
--   (streak_nudge on). Only the player's own choice; nothing else about them.
-- public.streak_nudges: the send log, one row per player per GMT day (primary key = at most once a day, and the
--   cron's idempotency claim). devices = pushes delivered (0 = no device took it). Pruned after 90 days.
-- private.streak_nudge_candidates(today, min, limit): who could get today's nudge: alerts on (a push
--   subscription), streak >= min, last clear yesterday (not extended today), not nudged today, the switch on,
--   never banned or test players. The local hour, quiet hours and age rules are applied by the cron
--   (lib/alerts/streak-nudge.ts). public.svc_streak_nudge_candidates is the service-role entry point.
-- private.admin_streak_nudge(from, to): admin Metrics part, per GMT day of the nudge: sn_sent (delivered to at
--   least one device) and sn_cleared (of those, a board cleared within 3 hours of the push). Test players left out.
-- public.svc_admin_metrics is redefined with every existing part (up to 20261204000701, with admin_growth as
--   replaced in 20261206000101) plus this one. client_metrics is untouched (these counts are server side).
-- Both tables are server-only: RLS forced, no grants to anon or authenticated.
--
-- Rollback:
--   re-run the `create or replace function public.svc_admin_metrics` statement (and its revoke and grant) from
--   supabase/migrations/20261204000701_growth_metrics.sql, then:
--   select cron.unschedule('spuzl-streak-nudges-prune');
--   drop function if exists private.admin_streak_nudge(date, date);
--   drop function if exists public.svc_streak_nudge_candidates(date, integer, integer);
--   drop function if exists private.streak_nudge_candidates(date, integer, integer);
--   drop table if exists public.streak_nudges;
--   drop table if exists public.alert_prefs;
--   delete from supabase_migrations.schema_migrations where version = '20261207000901';

create table if not exists public.alert_prefs (
  player_id uuid primary key references public.players (id) on delete cascade,
  streak_nudge boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.alert_prefs enable row level security;
alter table public.alert_prefs force row level security;
revoke all on public.alert_prefs from public, anon, authenticated;
grant all on public.alert_prefs to service_role;

create table if not exists public.streak_nudges (
  player_id uuid not null references public.players (id) on delete cascade,
  day date not null,
  streak integer not null check (streak >= 0),
  sent_at timestamptz not null default now(),
  devices smallint not null default 0 check (devices >= 0),
  primary key (player_id, day)
);
create index if not exists streak_nudges_day_idx on public.streak_nudges (day);
alter table public.streak_nudges enable row level security;
alter table public.streak_nudges force row level security;
revoke all on public.streak_nudges from public, anon, authenticated;
grant all on public.streak_nudges to service_role;

create or replace function private.streak_nudge_candidates(p_today date, p_min integer, p_limit integer default 5000)
returns table (player_id uuid, country text, age_band text, birth_year integer, birth_month integer, streak integer,
               freezes smallint)
language sql stable security definer set search_path = '' as $$
  select p.id, p.country, p.age_band, p.birth_year::integer, p.birth_month::integer, s.current, s.freezes_held
  from public.streaks s
  join public.players p on p.id = s.player_id
  left join public.alert_prefs ap on ap.player_id = p.id
  where s.current >= greatest(p_min, 1)
    and s.last_clear_date = p_today - 1
    and p.banned_at is null
    and not p.is_test
    and coalesce(ap.streak_nudge, true)
    and exists (select 1 from public.push_subscriptions ps where ps.player_id = p.id)
    and not exists (select 1 from public.streak_nudges n where n.player_id = p.id and n.day = p_today)
  order by s.current desc, p.id
  limit greatest(0, least(p_limit, 20000))
$$;
revoke execute on function private.streak_nudge_candidates(date, integer, integer) from public, anon, authenticated;

create or replace function public.svc_streak_nudge_candidates(p_today date, p_min integer, p_limit integer default 5000)
returns table (player_id uuid, country text, age_band text, birth_year integer, birth_month integer, streak integer,
               freezes smallint)
language sql stable security definer set search_path = '' as $$
  select * from private.streak_nudge_candidates(p_today, p_min, p_limit)
$$;
revoke execute on function public.svc_streak_nudge_candidates(date, integer, integer) from public, anon, authenticated;
grant execute on function public.svc_streak_nudge_candidates(date, integer, integer) to service_role;

create or replace function private.admin_streak_nudge(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  n as (
    select sn.day as d,
      exists (select 1 from public.attempts a
              where a.player_id = sn.player_id and a.status = 'cleared' and a.mode <> 'tutorial'
                and a.finished_at >= sn.sent_at and a.finished_at < sn.sent_at + interval '3 hours') as cleared
    from public.streak_nudges sn
    join public.players p on p.id = sn.player_id
    where sn.day between p_from and p_to and sn.devices > 0 and not p.is_test
  ),
  per as (
    select x.d, jsonb_build_object(
      'sn_sent', count(n.d),
      'sn_cleared', count(n.d) filter (where n.cleared)) as v
    from (select d from days union all select null::date) x
    left join n on x.d is null or n.d = x.d
    group by x.d
  )
  select jsonb_build_object(
    'total', (select v from per where d is null),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;
revoke execute on function private.admin_streak_nudge(date, date) from public, anon, authenticated;

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
  sn as (select private.admin_streak_nudge(p_from, p_to) as v)
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
      || coalesce(sn.v -> 'total', '{}'::jsonb),
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
    ), '[]'::jsonb))
  from m, f, db, pm, p, x, tw, fc, pr, rc, gv, gr, sn
$$;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;

select cron.unschedule('spuzl-streak-nudges-prune') where exists (select 1 from cron.job where jobname = 'spuzl-streak-nudges-prune');
select cron.schedule('spuzl-streak-nudges-prune', '37 3 * * *',
  $$delete from public.streak_nudges where day < (now() at time zone 'utc')::date - 90$$);
