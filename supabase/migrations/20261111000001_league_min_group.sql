-- Leagues: the weekly rollover keeps groups at or above leagues.minGroup where it can, and /leagues/current
-- needs no extra round trip for a player already placed this week.
--
-- 1. league_members.home_tier: the tier a player belongs to when the rollover placed them in a group of another
--    tier (null: the group's own tier). Promotion, demotion and next week's tier read coalesce(home_tier, tier),
--    so playing in a merged group never moves anyone up or down a tier by itself.
-- 2. private.league_rollover: each (test flag) pool still splits into the fewest groups of at most 30, as evenly
--    as possible, but first any tier with fewer than leagues.minGroup players (game setting, default 8) merges
--    into the nearest tier that has players (a larger pool wins a tie in distance, then the lower tier), until
--    every tier left is at least minGroup or only one tier is left. Merged players keep their home tier.
-- 3. Mid-week joins (league_candidates, join_current_league) treat a group as the player's tier when its own
--    tier matches or one of its members has that home tier, so a late joiner from a merged tier finds the
--    merged group instead of opening a group of one. They join with that home tier.
-- 4. private.league_candidates returns the player's league (id, tier, weekStart) when they are already placed
--    this week, so the API skips the join call and the leagues lookup.
--
-- Rollback:
--   re-run private.league_rollover(date) and its revoke from 20261106100002_league_grouping.sql;
--   re-run private.league_candidates(uuid) and private.join_current_league(uuid, uuid) from
--     20261108000001_play_day_streak.sql;
--   drop function if exists private.next_league_tier(uuid, date);
--   drop function if exists private.league_serves_tier(uuid, smallint);
--   drop function if exists private.league_min_group();
--   alter table public.league_members drop column if exists home_tier;

alter table public.league_members add column if not exists home_tier smallint check (home_tier between 0 and 4);
alter table public.league_members enable row level security;
alter table public.league_members force row level security;

-- ---------- helpers ----------
create or replace function private.league_min_group() returns integer
language sql stable security definer set search_path = '' as $$
  select least(30, greatest(2, coalesce(
    (select case when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric::int end
       from public.game_settings where key = 'leagues.minGroup'), 8)))
$$;

/** The tier a player plays at in the week after p_prev: their home tier there, moved by last week's result. */
create or replace function private.next_league_tier(p_player uuid, p_prev date) returns smallint
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select least(4, greatest(0, coalesce(lm.home_tier, l.tier)
                              + case lm.result when 'promoted' then 1 when 'demoted' then -1 else 0 end))::smallint
    from public.league_members lm join public.leagues l on l.id = lm.league_id
    where lm.player_id = p_player and l.week_start = p_prev
    limit 1), 0::smallint)
$$;

/** A group serves a tier when it is that tier, or the rollover merged players of that tier into it. */
create or replace function private.league_serves_tier(p_league uuid, p_tier smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.leagues l where l.id = p_league and l.tier = p_tier)
      or exists (select 1 from public.league_members m where m.league_id = p_league and m.home_tier = p_tier)
$$;

-- ---------- candidates ----------
create or replace function private.league_candidates(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare wk date := date_trunc('week', (now() at time zone 'utc'))::date; t smallint; test boolean; lvl integer; is_new boolean;
  out jsonb; placed record;
begin
  select is_test, level into test, lvl from public.players where id = p_player and banned_at is null;
  if test is null then return jsonb_build_object('eligible', false); end if;
  select l.id, l.tier, l.week_start into placed from public.league_members m join public.leagues l on l.id = m.league_id
    where m.player_id = p_player and l.week_start = wk;
  if placed.id is not null then
    return jsonb_build_object('eligible', false,
      'league', jsonb_build_object('id', placed.id, 'tier', placed.tier, 'weekStart', placed.week_start));
  end if;
  if not private.played_this_week(p_player, wk) then return jsonb_build_object('eligible', false); end if;
  is_new := not exists (select 1 from public.league_members m where m.player_id = p_player);
  t := private.next_league_tier(p_player, wk - 7);
  with fr as (select private.friend_ids(p_player) as id),
  pool as (
    select l.id, l.tier from public.leagues l
    where l.week_start = wk and l.finalised_at is null
      and (private.league_serves_tier(l.id, t)
           or (is_new and exists (select 1 from public.league_members m where m.league_id = l.id and m.player_id in (select id from fr))))
  ),
  agg as (
    select p.id, p.tier, count(*)::int as members,
      (count(*) filter (where m.player_id in (select id from fr)))::int as friends,
      round(avg(pl.level), 2) as avg_level,
      bool_or(pl.is_test <> test) as mixed
    from pool p join public.league_members m on m.league_id = p.id join public.players pl on pl.id = m.player_id
    group by p.id, p.tier
  )
  -- A merged group counts as the player's tier for the chooser (its tier field is what the chooser matches).
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tier', case when private.league_serves_tier(id, t) then t else tier end,
                                               'members', members, 'friends', friends, 'avgLevel', avg_level)
                            order by id), '[]'::jsonb)
    into out from agg where members < 30 and not mixed;
  return jsonb_build_object('eligible', true, 'tier', t, 'level', lvl, 'isNew', is_new, 'candidates', out);
end $$;

-- ---------- join ----------
create or replace function private.join_current_league(p_player uuid, p_league uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare wk date := date_trunc('week', (now() at time zone 'utc'))::date; lid uuid; t smallint; test boolean; pts integer; is_new boolean;
  ht smallint;
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
  t := private.next_league_tier(p_player, wk - 7);
  -- The chooser's pick, if it still holds under the lock.
  if p_league is not null then
    select l.id into lid from public.leagues l
      where l.id = p_league and l.week_start = wk and l.finalised_at is null
        and (select count(*) from public.league_members m where m.league_id = l.id) < 30
        and not exists (select 1 from public.league_members m join public.players p on p.id = m.player_id
                        where m.league_id = l.id and p.is_test <> test)
        and (private.league_serves_tier(l.id, t)
             or (is_new and exists (select 1 from public.league_members m
                                    where m.league_id = l.id and m.player_id in (select private.friend_ids(p_player)))));
  end if;
  if lid is null then
    select l.id into lid from public.leagues l
      where l.week_start = wk and l.finalised_at is null and private.league_serves_tier(l.id, t)
        and (select count(*) from public.league_members m where m.league_id = l.id) < 30
        and not exists (select 1 from public.league_members m join public.players p on p.id = m.player_id
                        where m.league_id = l.id and p.is_test <> test)
      order by (l.tier = t) desc, (select count(*) from public.league_members m where m.league_id = l.id) desc, l.id
      limit 1;
  end if;
  if lid is null then
    insert into public.leagues (tier, week_start) values (t, wk) returning id into lid;
  end if;
  -- Joining a merged group at another tier keeps the player's own tier (a friend's group adopts the group's tier).
  select case when l.tier <> t and exists (select 1 from public.league_members m where m.league_id = l.id and m.home_tier = t)
              then t end
    into ht from public.leagues l where l.id = lid;
  select coalesce(sum(amount), 0)::int into pts from public.xp_ledger
    where player_id = p_player and created_at >= wk::timestamp at time zone 'utc';
  insert into public.league_members (league_id, player_id, points, home_tier) values (lid, p_player, pts, ht);
  return lid;
end $$;

-- ---------- rollover: merge small tiers, then even groups ----------
create or replace function private.league_rollover(p_week date default date_trunc('week', (now() at time zone 'utc'))::date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare prev date := p_week - 7; groups integer := 0; merged integer := 0; min_group integer := private.league_min_group();
  flag boolean; cnt integer[]; dest integer[]; small integer; dst integer; t integer;
  members uuid[]; i integer; k integer; g integer; j integer; sz integer;
begin
  with ranked as (
    select m.league_id, m.player_id, coalesce(m.home_tier, l.tier) as tier,
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
  drop table if exists pg_temp.league_pool;
  create temp table league_pool on commit drop as
    select p.id as player_id, p.is_test, private.next_league_tier(p.id, prev)::integer as home,
      (select count(*) from public.attempts a where a.player_id = p.id and a.started_at > now() - interval '14 days') as activity
    from public.players p
    where p.banned_at is null and exists (select 1 from public.attempts a where a.player_id = p.id and a.started_at > now() - interval '14 days')
      and not exists (select 1 from public.league_members lm join public.leagues l on l.id = lm.league_id where lm.player_id = p.id and l.week_start = p_week);

  for flag in select distinct lp.is_test from pg_temp.league_pool lp order by 1 loop
    cnt := array[0, 0, 0, 0, 0];
    dest := array[0, 1, 2, 3, 4];
    for t, k in select lp.home, count(*)::int from pg_temp.league_pool lp where lp.is_test = flag group by lp.home loop
      cnt[t + 1] := k;
    end loop;
    -- Merge the smallest tier under the minimum into its nearest non-empty tier, until none is left or one tier remains.
    loop
      small := null;
      for t in 0 .. 4 loop
        if cnt[t + 1] > 0 and cnt[t + 1] < min_group and (small is null or cnt[t + 1] < cnt[small + 1]) then small := t; end if;
      end loop;
      exit when small is null;
      dst := null;
      for t in 0 .. 4 loop
        if t <> small and cnt[t + 1] > 0 and (dst is null or abs(t - small) < abs(dst - small)
            or (abs(t - small) = abs(dst - small) and cnt[t + 1] > cnt[dst + 1])) then
          dst := t;
        end if;
      end loop;
      exit when dst is null;
      cnt[dst + 1] := cnt[dst + 1] + cnt[small + 1];
      cnt[small + 1] := 0;
      for t in 0 .. 4 loop
        if dest[t + 1] = small then dest[t + 1] := dst; end if;
      end loop;
      merged := merged + 1;
    end loop;

    for t in 0 .. 4 loop
      continue when cnt[t + 1] = 0;
      select array_agg(lp.player_id order by lp.activity desc, lp.player_id) into members
        from pg_temp.league_pool lp where lp.is_test = flag and dest[lp.home + 1] = t;
      k := coalesce(array_length(members, 1), 0);
      if k = 0 then continue; end if;
      -- Fewest groups of at most 30, sizes differing by at most one.
      g := ceil(k / 30.0)::int;
      i := 1;
      for j in 0 .. g - 1 loop
        sz := k / g + case when j < k % g then 1 else 0 end;
        with nl as (insert into public.leagues (tier, week_start) values (t, p_week) returning id)
        insert into public.league_members (league_id, player_id, home_tier)
          select nl.id, lp.player_id, case when lp.home <> t then lp.home::smallint end
          from nl, unnest(members[i : i + sz - 1]) u(id) join pg_temp.league_pool lp on lp.player_id = u.id;
        groups := groups + 1;
        i := i + sz;
      end loop;
    end loop;
  end loop;
  drop table if exists pg_temp.league_pool;
  insert into public.audit_log (action, detail)
    values ('cron.league_rollover', jsonb_build_object('week', p_week, 'groups', groups, 'merged', merged, 'minGroup', min_group));
  return jsonb_build_object('week', p_week, 'groups', groups, 'merged', merged);
end $$;

revoke execute on function private.league_min_group(), private.next_league_tier(uuid, date),
  private.league_serves_tier(uuid, smallint), private.league_candidates(uuid), private.join_current_league(uuid, uuid),
  private.league_rollover(date)
  from public, anon, authenticated;
