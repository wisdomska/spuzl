-- SPZ-21: league grouping for new players, and no stragglers at the weekly rollover.
--
-- 1. private.league_candidates(player): the open groups this week a joining player could go into, with
--    member count, how many of them are the player's friends, and the average player level. The API runs the
--    pure chooser in lib/leagues/grouping.ts on it (game settings leagues.fillWithFriends, leagues.minGroup).
-- 2. private.join_current_league(player, league): joins the preferred group when it is still valid under the
--    join lock (this week, open, room, no test-account mixing, and the player's tier OR, for a brand new
--    player, a group with a friend in it). Otherwise the previous rule applies (fullest open group in tier).
-- 3. private.league_rollover: each (tier, test) pool is split into the fewest groups of at most 30, as evenly as
--    possible (31 players make 16 + 15, not 30 + 1), mirroring evenGroupSizes in lib/leagues/grouping.ts.
--
-- Rollback:
--   drop function if exists public.svc_league_candidates(uuid);
--   drop function if exists private.league_candidates(uuid);
--   drop function if exists public.svc_join_current_league(uuid, uuid);
--   drop function if exists private.join_current_league(uuid, uuid);
--   -- then re-run from 20261102000001_social_meta.sql: private.join_current_league(uuid),
--   --   public.svc_join_current_league(uuid) and its revoke/grant;
--   -- and from 20261031000001_test_accounts.sql: private.league_rollover(date) and its revoke.

-- ---------- candidates ----------
create or replace function private.league_candidates(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare wk date := date_trunc('week', (now() at time zone 'utc'))::date; t smallint; test boolean; lvl integer; is_new boolean;
  out jsonb;
begin
  select is_test, level into test, lvl from public.players where id = p_player and banned_at is null;
  if test is null
     or exists (select 1 from public.league_members m join public.leagues l on l.id = m.league_id
                where m.player_id = p_player and l.week_start = wk)
     or not exists (select 1 from public.daily_results r where r.player_id = p_player and r.date >= wk) then
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

-- ---------- join ----------
drop function if exists public.svc_join_current_league(uuid);
drop function if exists private.join_current_league(uuid);

create or replace function private.join_current_league(p_player uuid, p_league uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare wk date := date_trunc('week', (now() at time zone 'utc'))::date; lid uuid; t smallint; test boolean; pts integer; is_new boolean;
begin
  select l.id into lid from public.league_members m join public.leagues l on l.id = m.league_id
    where m.player_id = p_player and l.week_start = wk;
  if lid is not null then return lid; end if;
  if not exists (select 1 from public.daily_results r where r.player_id = p_player and r.date >= wk) then return null; end if;
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

-- ---------- rollover: even groups ----------
create or replace function private.league_rollover(p_week date default date_trunc('week', (now() at time zone 'utc'))::date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare prev date := p_week - 7; groups integer := 0; rec record; members uuid[]; i integer; k integer; g integer; j integer; sz integer;
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

  -- New week placement: everyone who played in the last 14 days, test accounts kept apart.
  for rec in
    with next_tier as (
      select p.id as player_id, p.is_test,
        coalesce((select least(4, greatest(0, l.tier + case lm.result when 'promoted' then 1 when 'demoted' then -1 else 0 end))
                  from public.league_members lm join public.leagues l on l.id = lm.league_id
                  where lm.player_id = p.id and l.week_start = prev), 0) as tier,
        (select count(*) from public.attempts a where a.player_id = p.id and a.started_at > now() - interval '14 days') as activity
      from public.players p
      where p.banned_at is null and exists (select 1 from public.attempts a where a.player_id = p.id and a.started_at > now() - interval '14 days')
        and not exists (select 1 from public.league_members lm join public.leagues l on l.id = lm.league_id where lm.player_id = p.id and l.week_start = p_week)
    )
    select tier, is_test, array_agg(player_id order by activity desc, player_id) as ids from next_tier group by tier, is_test
  loop
    k := coalesce(array_length(rec.ids, 1), 0);
    if k = 0 then continue; end if;
    -- Fewest groups of at most 30, sizes differing by at most one.
    g := ceil(k / 30.0)::int;
    i := 1;
    for j in 0 .. g - 1 loop
      sz := k / g + case when j < k % g then 1 else 0 end;
      members := rec.ids[i : i + sz - 1];
      with nl as (insert into public.leagues (tier, week_start) values (rec.tier, p_week) returning id)
      insert into public.league_members (league_id, player_id) select nl.id, unnest(members) from nl;
      groups := groups + 1;
      i := i + sz;
    end loop;
  end loop;
  insert into public.audit_log (action, detail) values ('cron.league_rollover', jsonb_build_object('week', p_week, 'groups', groups));
  return jsonb_build_object('week', p_week, 'groups', groups);
end $$;

-- ---------- service entry points ----------
create or replace function public.svc_league_candidates(p_player uuid) returns jsonb
language sql stable security definer set search_path = '' as $$ select private.league_candidates(p_player) $$;
create or replace function public.svc_join_current_league(p_player uuid, p_league uuid default null) returns uuid
language sql security definer set search_path = '' as $$ select private.join_current_league(p_player, p_league) $$;

revoke execute on function private.league_candidates(uuid), private.join_current_league(uuid, uuid), private.league_rollover(date)
  from public, anon, authenticated;
revoke execute on function public.svc_league_candidates(uuid), public.svc_join_current_league(uuid, uuid) from public, anon, authenticated;
grant execute on function public.svc_league_candidates(uuid), public.svc_join_current_league(uuid, uuid) to service_role;
