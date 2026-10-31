-- Game-day accounting: streaks, results, rollover, leagues. All GMT.

-- Records a verified Daily clear: daily_results row + streak update. Idempotent per (player, game, date).
-- Returns the streak after the clear and whether this clear extended it.
create or replace function private.record_daily_clear(p_player uuid, p_game text, p_date date, p_time integer, p_score integer, p_hints integer, p_mistakes integer)
returns table (streak integer, extended boolean, first_today boolean, freeze_earned boolean)
language plpgsql security definer set search_path = '' as $$
declare s public.streaks; inserted boolean := false; any_today boolean;
begin
  select exists (select 1 from public.daily_results where player_id = p_player and date = p_date) into any_today;
  insert into public.daily_results (date, game_id, player_id, time_ms, score, hints, mistakes, finished_at)
    values (p_date, p_game, p_player, p_time, p_score, p_hints, p_mistakes, now())
    on conflict do nothing returning true into inserted;
  insert into public.streaks (player_id) values (p_player) on conflict do nothing;
  select * into s from public.streaks where player_id = p_player for update;
  extended := false; freeze_earned := false; first_today := coalesce(inserted, false) and not any_today;
  if first_today and (s.last_clear_date is null or s.last_clear_date < p_date) then
    if s.last_clear_date = p_date - 1 then s.current := s.current + 1; else s.current := 1; end if;
    -- Streak Repair: clearing 3 Dailies within 48 h of losing a 7+ streak restores it (counted by app).
    s.best := greatest(s.best, s.current);
    s.last_clear_date := p_date;
    extended := true;
    -- A Freeze is earned every 7-day streak, hold up to 2.
    if s.current % 7 = 0 and s.freezes_held < 2 then s.freezes_held := s.freezes_held + 1; freeze_earned := true; end if;
    update public.streaks set current = s.current, best = s.best, last_clear_date = s.last_clear_date, freezes_held = s.freezes_held, updated_at = now()
      where player_id = p_player;
  end if;
  streak := s.current;
  return next;
end $$;

-- Restores a lost 7+ streak (Streak Repair). Called by the app after 3 Daily clears within 48 h.
create or replace function private.repair_streak(p_player uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare s public.streaks;
begin
  select * into s from public.streaks where player_id = p_player for update;
  if s.lost_value < 7 or s.lost_on is null or s.lost_on < (now() at time zone 'utc')::date - 2 then return s.current; end if;
  update public.streaks set current = s.lost_value + s.current, best = greatest(best, s.lost_value + s.current), lost_value = 0, lost_on = null
    where player_id = p_player;
  return s.lost_value + s.current;
end $$;

-- Ranks one day's boards: fastest valid time, then fewer hints, fewer mistakes, earlier finish (SRS 4.10).
-- Score games rank by score desc first.
create or replace function private.rank_day(p_date date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  with ranked as (
    select r.date, r.game_id, r.player_id,
      rank() over (partition by r.game_id order by
        case when g.scoring = 'score' then -coalesce(r.score, 0) else 0 end,
        r.time_ms, r.hints, r.mistakes, r.finished_at) as rk,
      count(*) over (partition by r.game_id) as n
    from public.daily_results r join public.games g on g.id = r.game_id
    where r.date = p_date
  )
  update public.daily_results d set rank_global = ranked.rk,
    percentile = round(100.0 * (ranked.n - ranked.rk) / greatest(ranked.n - 1, 1), 2)
  from ranked where d.date = ranked.date and d.game_id = ranked.game_id and d.player_id = ranked.player_id;
end $$;

-- Daily rollover at 00:00 GMT: finalise yesterday, apply Freezes or break streaks, prune.
create or replace function private.daily_rollover(p_today date default (now() at time zone 'utc')::date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare y date := p_today - 1; frozen integer; lost integer; missing integer; pruned integer; rooms integer;
begin
  perform private.rank_day(y);
  -- Missed yesterday entirely: a held Freeze covers one day, otherwise the streak is lost.
  with f as (
    update public.streaks set freezes_held = freezes_held - 1, last_clear_date = y, updated_at = now()
    where current > 0 and last_clear_date = y - 1 and freezes_held > 0 returning 1
  ) select count(*) into frozen from f;
  with l as (
    update public.streaks set lost_value = current, lost_on = p_today, current = 0, updated_at = now()
    where current > 0 and last_clear_date < y returning 1
  ) select count(*) into lost from l;
  -- Publish today's Dailies
  update public.dailies set published_at = now() where date = p_today and published_at is null;
  select count(*) into missing from public.games g where g.status = 'live'
    and not exists (select 1 from public.dailies d where d.date = p_today and d.game_id = g.id);
  -- Prune: move logs older than 90 days (keep flagged), abandoned rooms after 24 h, stale queue entries
  with p as (
    update public.attempts set moves = null where moves is not null and started_at < now() - interval '90 days' and status <> 'flagged' returning 1
  ) select count(*) into pruned from p;
  with r as (
    delete from public.matches where (status in ('lobby', 'queue', 'abandoned') and created_at < now() - interval '24 hours')
      or (emptied_at is not null and emptied_at < now() - interval '2 hours') returning 1
  ) select count(*) into rooms from r;
  delete from public.matchmaking_queue where enqueued_at < now() - interval '10 minutes';
  delete from public.rate_limits where window_start < now() - interval '1 day';
  update public.attempts set status = 'abandoned' where status = 'in_progress' and mode <> 'daily' and started_at < now() - interval '2 days';
  insert into public.audit_log (action, detail) values ('cron.daily_rollover',
    jsonb_build_object('date', p_today, 'frozen', frozen, 'lost', lost, 'missing_dailies', missing, 'pruned_moves', pruned, 'rooms', rooms));
  return jsonb_build_object('date', p_today, 'frozen', frozen, 'lost', lost, 'missing_dailies', missing, 'pruned_moves', pruned, 'rooms', rooms);
end $$;

-- Weekly leagues (Monday 00:00 GMT): top 7 promote, bottom 5 demote, others stay (SRS 4.4).
-- Then places last week's active players into new groups of 30 by tier and activity.
create or replace function private.league_rollover(p_week date default date_trunc('week', (now() at time zone 'utc'))::date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare prev date := p_week - 7; groups integer := 0; rec record; members uuid[]; i integer;
begin
  with ranked as (
    select m.league_id, m.player_id, l.tier,
      row_number() over (partition by m.league_id order by m.points desc, m.player_id) as rk,
      count(*) over (partition by m.league_id) as n
    from public.league_members m join public.leagues l on l.id = m.league_id
    where l.week_start = prev and l.finalised_at is null
  )
  update public.league_members lm set final_rank = r.rk,
    result = case when r.rk <= 7 and r.tier < 4 then 'promoted' when r.rk > r.n - 5 and r.n > 12 and r.tier > 0 then 'demoted' else 'stayed' end
  from ranked r where lm.league_id = r.league_id and lm.player_id = r.player_id;
  update public.leagues set finalised_at = now() where week_start = prev and finalised_at is null;

  -- New week placement: everyone who played in the last 14 days.
  for rec in
    with next_tier as (
      select p.id as player_id,
        coalesce((select least(4, greatest(0, l.tier + case lm.result when 'promoted' then 1 when 'demoted' then -1 else 0 end))
                  from public.league_members lm join public.leagues l on l.id = lm.league_id
                  where lm.player_id = p.id and l.week_start = prev), 0) as tier,
        (select count(*) from public.attempts a where a.player_id = p.id and a.started_at > now() - interval '14 days') as activity
      from public.players p
      where p.banned_at is null and exists (select 1 from public.attempts a where a.player_id = p.id and a.started_at > now() - interval '14 days')
        and not exists (select 1 from public.league_members lm join public.leagues l on l.id = lm.league_id where lm.player_id = p.id and l.week_start = p_week)
    )
    select tier, array_agg(player_id order by activity desc, player_id) as ids from next_tier group by tier
  loop
    i := 1;
    while i <= coalesce(array_length(rec.ids, 1), 0) loop
      members := rec.ids[i : i + 29];
      with nl as (insert into public.leagues (tier, week_start) values (rec.tier, p_week) returning id)
      insert into public.league_members (league_id, player_id) select nl.id, unnest(members) from nl;
      groups := groups + 1;
      i := i + 30;
    end loop;
  end loop;
  insert into public.audit_log (action, detail) values ('cron.league_rollover', jsonb_build_object('week', p_week, 'groups', groups));
  return jsonb_build_object('week', p_week, 'groups', groups);
end $$;

-- League points = XP earned in the week (SRS 4.4). Kept in sync by a ledger trigger.
create or replace function private.on_xp_ledger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.league_members lm set points = points + new.amount
  from public.leagues l
  where lm.league_id = l.id and lm.player_id = new.player_id and l.week_start = date_trunc('week', (new.created_at at time zone 'utc'))::date;
  return new;
end $$;
create trigger xp_ledger_league_points after insert on public.xp_ledger for each row execute function private.on_xp_ledger();

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_friend(uuid), private.in_match(uuid), private.in_league(uuid) to authenticated;

-- Service-role entry points (PostgREST exposes public only). Never callable by anon/authenticated.
create or replace function public.svc_grant_reward(p_player uuid, p_source text, p_ref text, p_xp integer, p_sparks integer)
returns table (xp_added integer, sparks_added integer, level_before integer, level_after integer)
language sql security definer set search_path = '' as $$ select * from private.grant_reward(p_player, p_source, p_ref, p_xp, p_sparks) $$;
create or replace function public.svc_spend_sparks(p_player uuid, p_source text, p_ref text, p_amount integer) returns bigint
language sql security definer set search_path = '' as $$ select private.spend_sparks(p_player, p_source, p_ref, p_amount) $$;
create or replace function public.svc_record_daily_clear(p_player uuid, p_game text, p_date date, p_time integer, p_score integer, p_hints integer, p_mistakes integer)
returns table (streak integer, extended boolean, first_today boolean, freeze_earned boolean)
language sql security definer set search_path = '' as $$ select * from private.record_daily_clear(p_player, p_game, p_date, p_time, p_score, p_hints, p_mistakes) $$;
create or replace function public.svc_repair_streak(p_player uuid) returns integer
language sql security definer set search_path = '' as $$ select private.repair_streak(p_player) $$;
create or replace function public.svc_daily_rollover(p_today date default (now() at time zone 'utc')::date) returns jsonb
language sql security definer set search_path = '' as $$ select private.daily_rollover(p_today) $$;
create or replace function public.svc_league_rollover(p_week date default date_trunc('week', (now() at time zone 'utc'))::date) returns jsonb
language sql security definer set search_path = '' as $$ select private.league_rollover(p_week) $$;
create or replace function public.health() returns integer language sql stable as $$ select 1 $$;

revoke execute on function public.svc_grant_reward(uuid, text, text, integer, integer), public.svc_spend_sparks(uuid, text, text, integer),
  public.svc_record_daily_clear(uuid, text, date, integer, integer, integer, integer), public.svc_repair_streak(uuid),
  public.svc_daily_rollover(date), public.svc_league_rollover(date) from public, anon, authenticated;
grant execute on function public.svc_grant_reward(uuid, text, text, integer, integer), public.svc_spend_sparks(uuid, text, text, integer),
  public.svc_record_daily_clear(uuid, text, date, integer, integer, integer, integer), public.svc_repair_streak(uuid),
  public.svc_daily_rollover(date), public.svc_league_rollover(date) to service_role;
grant execute on function public.health() to anon, authenticated, service_role;

-- Schedules (pg_cron runs in GMT): Daily rollover at 00:00, leagues Monday 00:05.
create extension if not exists pg_cron;
select cron.schedule('spuzl-daily-rollover', '0 0 * * *', $$select private.daily_rollover()$$);
select cron.schedule('spuzl-league-rollover', '5 0 * * 1', $$select private.league_rollover()$$);
