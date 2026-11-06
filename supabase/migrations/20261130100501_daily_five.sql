-- R2-05 Daily Five: five short shared puzzles a day (one per visible world plus a rotating bonus).
--
-- public.daily_five       one row per (date, slot 1..5): the game and the scheduled puzzle everyone plays that day.
--                         source 'auto' (picked by the composition rules in game settings) or 'manual' (picked in the
--                         admin Daily Five scheduler). A locked day keeps its games and puzzles: the auto-pick never
--                         changes it and the trigger refuses edits and deletes until it is unlocked.
--                         Server only: no client grants, RLS enabled and forced. /api/v1/daily-five serves it.
-- attempts.daily_five     true on a Daily Five attempt (mode 'daily', daily_date = the Daily Five day, puzzle from
--                         daily_five). Lets the moderation queue filter fast-solve flags to the Daily Five.
-- client_metrics          accepts daily5_start, daily5_complete and daily5_share (anonymous, like the others).
-- private.admin_daily_five(from, to) counts them per GMT day, plus players and full fives from attempts, and
-- public.svc_admin_metrics merges it with the existing numbers (same shape, so callers are unchanged).
--
-- Existing rows are untouched: the new column defaults to false and the new table starts empty.
--
-- Rollback:
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
--   drop function if exists private.admin_daily_five(date, date);
--   delete from public.client_metrics where name in ('daily5_start', 'daily5_complete', 'daily5_share');
--   alter table public.client_metrics drop constraint if exists client_metrics_name_check;
--   alter table public.client_metrics add constraint client_metrics_name_check
--     check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step'));
--   drop index if exists public.attempts_daily_five_flagged_idx;
--   drop index if exists public.attempts_daily_five_day_idx;
--   alter table public.attempts drop column if exists daily_five;
--   drop table if exists public.daily_five;
--   drop function if exists private.guard_locked_daily_five();
--   delete from supabase_migrations.schema_migrations where version = '20261130100501';

-- ---------- daily_five ----------
create table if not exists public.daily_five (
  date date not null,
  slot smallint not null check (slot between 1 and 5),
  kind text not null check (kind in ('world', 'bonus')),
  world text not null check (world ~ '^[a-z]{2,16}$'),
  game_id text not null references public.games(id),
  puzzle_id uuid not null references public.puzzles(id),
  source text not null default 'auto' check (source in ('auto', 'manual')),
  locked boolean not null default false,
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (date, slot),
  unique (date, game_id)
);
create index if not exists daily_five_puzzle_idx on public.daily_five (puzzle_id);
alter table public.daily_five enable row level security;
alter table public.daily_five force row level security;
revoke all on public.daily_five from public, anon, authenticated;

-- A locked day keeps its games and puzzles; it is never deleted while locked.
create or replace function private.guard_locked_daily_five() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.locked then
      raise exception 'daily five % slot % is locked', old.date, old.slot using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.locked and new.locked
     and (new.game_id is distinct from old.game_id or new.puzzle_id is distinct from old.puzzle_id
          or new.source is distinct from old.source or new.kind is distinct from old.kind) then
    raise exception 'daily five % slot % is locked', old.date, old.slot using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function private.guard_locked_daily_five() from public, anon, authenticated;
drop trigger if exists daily_five_locked_guard on public.daily_five;
create trigger daily_five_locked_guard before update or delete on public.daily_five
  for each row execute function private.guard_locked_daily_five();

-- ---------- attempts.daily_five ----------
alter table public.attempts add column if not exists daily_five boolean not null default false;
create index if not exists attempts_daily_five_flagged_idx on public.attempts (finished_at desc) where daily_five and status = 'flagged';
create index if not exists attempts_daily_five_day_idx on public.attempts (daily_date) where daily_five;

-- ---------- client_metrics: Daily Five events ----------
alter table public.client_metrics drop constraint if exists client_metrics_name_check;
alter table public.client_metrics add constraint client_metrics_name_check
  check (name in ('tap_to_board', 'hint_cancel', 'hint_request', 'hint_use', 'share', 'onboarding_step',
                  'daily5_start', 'daily5_complete', 'daily5_share'));
alter table public.client_metrics enable row level security;
alter table public.client_metrics force row level security;

create or replace function private.admin_daily_five(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select p_from::timestamp at time zone 'utc' as lo, (p_to + 1)::timestamp at time zone 'utc' as hi
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  cm as (
    select (c.created_at at time zone 'utc')::date as d, c.name
    from public.client_metrics c, b
    where c.created_at >= b.lo and c.created_at < b.hi and c.name in ('daily5_start', 'daily5_complete', 'daily5_share')
  ),
  -- Server truth from attempts (test players left out): who played a Daily Five game, and who finished all five.
  pl as (
    select a.daily_date as d, a.player_id,
           count(*) filter (where a.status in ('cleared', 'failed', 'flagged')) as finished
    from public.attempts a
    join public.players p on p.id = a.player_id and not coalesce(p.is_test, false)
    where a.daily_five and a.daily_date between p_from and p_to
    group by a.daily_date, a.player_id
  ),
  per as (
    select x.d, jsonb_build_object(
      'daily5_starts', (select count(*) from cm where cm.name = 'daily5_start' and (x.d is null or cm.d = x.d)),
      'daily5_completes', (select count(*) from cm where cm.name = 'daily5_complete' and (x.d is null or cm.d = x.d)),
      'daily5_shares', (select count(*) from cm where cm.name = 'daily5_share' and (x.d is null or cm.d = x.d)),
      'daily5_players', (select count(*) from pl where x.d is null or pl.d = x.d),
      'daily5_full', (select count(*) from pl where pl.finished >= 5 and (x.d is null or pl.d = x.d))) as v
    from (select d from days union all select null::date) x
  )
  select jsonb_build_object(
    'total', (select v from per where d is null),
    'days', coalesce((select jsonb_agg(v || jsonb_build_object('date', d) order by d) from per where d is not null), '[]'::jsonb))
$$;

create or replace function public.svc_admin_metrics(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with m as (select private.admin_metrics(p_from, p_to) as v),
  f as (select private.admin_client_funnel(p_from, p_to) as v),
  x as (select private.admin_daily_five(p_from, p_to) as v)
  select m.v || jsonb_build_object(
    'total', (m.v -> 'total') || (f.v -> 'total') || (x.v -> 'total'),
    'days', coalesce((
      select jsonb_agg(md.v || coalesce(fd.v - 'date', '{}'::jsonb) || coalesce(xd.v - 'date', '{}'::jsonb) order by md.i)
      from jsonb_array_elements(m.v -> 'days') with ordinality md(v, i)
      left join jsonb_array_elements(f.v -> 'days') fd(v) on fd.v ->> 'date' = md.v ->> 'date'
      left join jsonb_array_elements(x.v -> 'days') xd(v) on xd.v ->> 'date' = md.v ->> 'date'
    ), '[]'::jsonb))
  from m, f, x
$$;

revoke execute on function private.admin_daily_five(date, date) from public, anon, authenticated;
revoke execute on function public.svc_admin_metrics(date, date) from public, anon, authenticated;
grant execute on function public.svc_admin_metrics(date, date) to service_role;
