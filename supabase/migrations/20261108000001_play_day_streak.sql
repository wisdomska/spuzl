-- Dailies off: the streak counts days with at least one clear in free play (or any solo clear).
-- private.record_play_day(player, date) is record_daily_clear without the daily_results row: the first clear of a
-- GMT day extends the streak (or restarts it at 1), with the same Freeze rule (one earned every 7 days, hold 2).
-- Idempotent per (player, day): later clears that day change nothing. The nightly rollover keeps working
-- unchanged because it reads streaks.last_clear_date only.
-- Leagues: a player joins this week's league after any clear this week (a free-play clear, a Daily, an archive
-- puzzle), not only after a Daily. private.played_this_week holds that rule for league_candidates and
-- join_current_league (both otherwise unchanged from 20261106100002_league_grouping.sql).
-- Rollback:
--   re-run private.league_candidates and private.join_current_league from 20261106100002_league_grouping.sql;
--   drop function if exists private.played_this_week(uuid, date);
--   drop function if exists public.svc_record_play_day(uuid, date);
--   drop function if exists private.record_play_day(uuid, date);
create or replace function private.record_play_day(p_player uuid, p_date date)
returns table (streak integer, extended boolean, freeze_earned boolean)
language plpgsql security definer set search_path = '' as $$
declare s public.streaks;
begin
  insert into public.streaks (player_id) values (p_player) on conflict do nothing;
  select * into s from public.streaks where player_id = p_player for update;
  extended := false; freeze_earned := false;
  if s.last_clear_date is null or s.last_clear_date < p_date then
    if s.last_clear_date = p_date - 1 then s.current := s.current + 1; else s.current := 1; end if;
    s.best := greatest(s.best, s.current);
    s.last_clear_date := p_date;
    extended := true;
    if s.current % 7 = 0 and s.freezes_held < 2 then s.freezes_held := s.freezes_held + 1; freeze_earned := true; end if;
    update public.streaks set current = s.current, best = s.best, last_clear_date = s.last_clear_date,
      freezes_held = s.freezes_held, updated_at = now()
      where player_id = p_player;
  end if;
  streak := s.current;
  return next;
end $$;

create or replace function public.svc_record_play_day(p_player uuid, p_date date)
returns table (streak integer, extended boolean, freeze_earned boolean)
language sql security definer set search_path = '' as $$ select * from private.record_play_day(p_player, p_date) $$;

revoke execute on function private.record_play_day(uuid, date) from public, anon, authenticated;
revoke execute on function public.svc_record_play_day(uuid, date) from public, anon, authenticated;
grant execute on function public.svc_record_play_day(uuid, date) to service_role;

-- ---------- leagues: any clear this week ----------
create or replace function private.played_this_week(p_player uuid, p_week date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.daily_results r where r.player_id = p_player and r.date >= p_week)
      or exists (select 1 from public.attempts a where a.player_id = p_player and a.status = 'cleared'
                 and a.mode <> 'tutorial' and a.finished_at >= p_week::timestamptz)
$$;
revoke execute on function private.played_this_week(uuid, date) from public, anon, authenticated;

create or replace function private.league_candidates(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare wk date := date_trunc('week', (now() at time zone 'utc'))::date; t smallint; test boolean; lvl integer; is_new boolean;
  out jsonb;
begin
  select is_test, level into test, lvl from public.players where id = p_player and banned_at is null;
  if test is null
     or exists (select 1 from public.league_members m join public.leagues l on l.id = m.league_id
                where m.player_id = p_player and l.week_start = wk)
     or not private.played_this_week(p_player, wk) then
    return jsonb_build_object('eligible', false);
  end if;
  is_new := not exists (select 1 from public.league_members m where m.player_id = p_player);
  select coalesce((select least(4, greatest(0, l.tier + case lm.result when 'promoted' then 1 when 'demoted' then -1 else 0 end))
                   from public.league_members lm join public.leagues l on l.id = lm.league_id
                   where lm.player_id = p_player and l.week_start = wk - 7), 0) into t;
  with fr as (select private.friend_ids(p_player) as id),
  pool as (
    select l.id, l.tier from public.leagues l
    where l.week_start = wk and l.finalised_at is null
      and (l.tier = t or (is_new and exists (select 1 from public.league_members m where m.league_id = l.id and m.player_id in (select id from fr))))
  ),
  agg as (
    select p.id, p.tier, count(*)::int as members,
      (count(*) filter (where m.player_id in (select id from fr)))::int as friends,
      round(avg(pl.level), 2) as avg_level,
      bool_or(pl.is_test <> test) as mixed
    from pool p join public.league_members m on m.league_id = p.id join public.players pl on pl.id = m.player_id
    group by p.id, p.tier
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tier', tier, 'members', members, 'friends', friends, 'avgLevel', avg_level)
                            order by id), '[]'::jsonb)
    into out from agg where members < 30 and not mixed;
  return jsonb_build_object('eligible', true, 'tier', t, 'level', lvl, 'isNew', is_new, 'candidates', out);
end $$;

create or replace function private.join_current_league(p_player uuid, p_league uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare wk date := date_trunc('week', (now() at time zone 'utc'))::date; lid uuid; t smallint; test boolean; pts integer; is_new boolean;
begin
  select l.id into lid from public.league_members m join public.leagues l on l.id = m.league_id
    where m.player_id = p_player and l.week_start = wk;
  if lid is not null then return lid; end if;
  if not private.played_this_week(p_player, wk) then return null; end if;
  select is_test into test from public.players where id = p_player and banned_at is null;
  if test is null then return null; end if;
  perform pg_advisory_xact_lock(hashtext('spuzl.league_join:' || wk::text));
  -- re-check under the lock
  select l.id into lid from public.league_members m join public.leagues l on l.id = m.league_id
    where m.player_id = p_player and l.week_start = wk;
  if lid is not null then return lid; end if;
  is_new := not exists (select 1 from public.league_members m where m.player_id = p_player);
  select coalesce((select least(4, greatest(0, l.tier + case lm.result when 'promoted' then 1 when 'demoted' then -1 else 0 end))
                   from public.league_members lm join public.leagues l on l.id = lm.league_id
                   where lm.player_id = p_player and l.week_start = wk - 7), 0) into t;
  -- The chooser's pick, if it still holds under the lock.
  if p_league is not null then
    select l.id into lid from public.leagues l
      where l.id = p_league and l.week_start = wk and l.finalised_at is null
        and (select count(*) from public.league_members m where m.league_id = l.id) < 30
        and not exists (select 1 from public.league_members m join public.players p on p.id = m.player_id
                        where m.league_id = l.id and p.is_test <> test)
        and (l.tier = t or (is_new and exists (select 1 from public.league_members m
                                               where m.league_id = l.id and m.player_id in (select private.friend_ids(p_player)))));
  end if;
  if lid is null then
    select l.id into lid from public.leagues l
      where l.week_start = wk and l.tier = t and l.finalised_at is null
        and (select count(*) from public.league_members m where m.league_id = l.id) < 30
        and not exists (select 1 from public.league_members m join public.players p on p.id = m.player_id
                        where m.league_id = l.id and p.is_test <> test)
      order by (select count(*) from public.league_members m where m.league_id = l.id) desc, l.id
      limit 1;
  end if;
  if lid is null then
    insert into public.leagues (tier, week_start) values (t, wk) returning id into lid;
  end if;
  select coalesce(sum(amount), 0)::int into pts from public.xp_ledger
    where player_id = p_player and created_at >= wk::timestamp at time zone 'utc';
  insert into public.league_members (league_id, player_id, points) values (lid, p_player, pts);
  return lid;
end $$;
