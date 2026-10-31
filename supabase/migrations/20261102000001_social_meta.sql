-- Social and meta: friends, presence, feed, leaderboards, leagues (midweek join + ceremony), quests,
-- shop purchases, crews and crew clash, School Cup, streak calendar.
-- Every write still goes through /api/v1 route handlers using the service role; the functions below are
-- server entry points (svc_*) granted to service_role only. Clients keep SELECT-only RLS on their own rows.

-- ---------- indexes for social lookups (FK columns and scope filters) ----------
-- One friendship row per unordered pair: a request from b to a can't coexist with one from a to b.
create unique index if not exists friendships_pair_uniq
  on public.friendships (least(player_id, friend_id), greatest(player_id, friend_id));
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
create unique index if not exists invites_one_per_player on public.invites (player_id);
create index if not exists reactions_player_idx on public.reactions (player_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at desc);
create index if not exists players_place_idx on public.players (country, city);
create index if not exists crews_owner_idx on public.crews (owner_id);
create unique index if not exists crew_clashes_a_week on public.crew_clashes (week_start, crew_a);
create unique index if not exists crew_clashes_b_week on public.crew_clashes (week_start, crew_b);
create index if not exists crew_clashes_b_idx on public.crew_clashes (crew_b);
create index if not exists school_cups_school_idx on public.school_cups (school_id);
create index if not exists school_cups_teacher_idx on public.school_cups (teacher_id);
create index if not exists school_cup_members_player_idx on public.school_cup_members (player_id);
create index if not exists inventory_cosmetic_idx on public.inventory (cosmetic_id);
create index if not exists player_badges_badge_idx on public.player_badges (badge_id);
create index if not exists player_quests_quest_idx on public.player_quests (quest_id);
create index if not exists feed_events_game_idx on public.feed_events (game_id);

-- ---------- columns ----------
-- Practice hint packs bought in the Shop (never usable on ranked Dailies).
alter table public.players add column if not exists practice_hints integer not null default 0 check (practice_hints >= 0);
-- School Cup: the teacher picks the run (Mon to Fri by default) and can turn Relaxed mode on for the class.
alter table public.school_cups add column if not exists ends_on date;
alter table public.school_cups add column if not exists relaxed boolean not null default false;
alter table public.school_cups drop constraint if exists school_cups_run_check;
alter table public.school_cups add constraint school_cups_run_check
  check (ends_on is null or (ends_on >= week_start and ends_on <= week_start + 6));
alter table public.school_cups drop constraint if exists school_cups_games_check;
alter table public.school_cups add constraint school_cups_games_check check (cardinality(games) between 1 and 5);

-- ---------- streak calendar: days a Freeze covered ----------
create table if not exists public.streak_frozen_days (
  player_id uuid not null references public.players(id) on delete cascade,
  day date not null,
  primary key (player_id, day)
);
alter table public.streak_frozen_days enable row level security;
alter table public.streak_frozen_days force row level security;
revoke insert, update, delete, truncate on public.streak_frozen_days from anon, authenticated;
create policy streak_frozen_days_own on public.streak_frozen_days for select to authenticated
  using (player_id = (select auth.uid()));

-- The rollover spends a Freeze by moving last_clear_date forward one day without a clear. Record that day.
create or replace function private.on_streak_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.freezes_held < old.freezes_held and new.last_clear_date is distinct from old.last_clear_date
     and new.last_clear_date is not null then
    insert into public.streak_frozen_days (player_id, day) values (new.player_id, new.last_clear_date) on conflict do nothing;
  end if;
  -- Streak milestones show up in friends' feeds.
  if new.current > old.current and new.current in (3, 7, 14, 30, 50, 100, 365) then
    insert into public.feed_events (player_id, kind, payload) values (new.player_id, 'streak', jsonb_build_object('days', new.current));
  end if;
  return new;
end $$;
drop trigger if exists streaks_social on public.streaks;
create trigger streaks_social after update on public.streaks for each row execute function private.on_streak_change();

-- Badge and level events for the friends feed (clears are written by the attempts service).
create or replace function private.on_badge_earned() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.feed_events (player_id, kind, payload) values (new.player_id, 'badge', jsonb_build_object('badge', new.badge_id));
  return new;
end $$;
drop trigger if exists player_badges_feed on public.player_badges;
create trigger player_badges_feed after insert on public.player_badges for each row execute function private.on_badge_earned();

create or replace function private.on_level_up() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.level > old.level and new.level % 5 = 0 then
    insert into public.feed_events (player_id, kind, payload) values (new.id, 'level', jsonb_build_object('level', new.level));
  end if;
  return new;
end $$;
drop trigger if exists players_level_feed on public.players;
create trigger players_level_feed after update of level on public.players for each row execute function private.on_level_up();

-- ---------- RLS: the feed respects "hide activity" and blocks ----------
create or replace function private.hides_activity(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select hide_activity from public.players where id = p), true)
$$;
create or replace function private.is_blocked_pair(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (player_id = (select auth.uid()) and blocked_id = other) or (player_id = other and blocked_id = (select auth.uid()))
  )
$$;
drop policy if exists feed_read on public.feed_events;
create policy feed_read on public.feed_events for select to authenticated
  using (
    player_id = (select auth.uid())
    or ((select private.is_friend(player_id)) and not (select private.hides_activity(player_id)) and not (select private.is_blocked_pair(player_id)))
  );

-- ---------- helpers (server only) ----------
create or replace function private.friend_ids(p uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select case when player_id = p then friend_id else player_id end
  from public.friendships where status = 'accepted' and (player_id = p or friend_id = p)
$$;

-- Mutual friend counts for a list of other players (friend requests show "3 mutual").
create or replace function private.mutual_counts(p uuid, others uuid[])
returns table (other uuid, n integer) language sql stable security definer set search_path = '' as $$
  select o, (select count(*)::int from private.friend_ids(o) f where f in (select private.friend_ids(p)))
  from unnest(others) o
$$;

-- Duel head-to-head between two players (friend profile "You vs Kofi").
create or replace function private.duel_record(a uuid, b uuid)
returns table (wins_a integer, wins_b integer) language sql stable security definer set search_path = '' as $$
  select count(*) filter (where m.winner_id = a)::int, count(*) filter (where m.winner_id = b)::int
  from public.matches m
  where m.kind = 'duel' and m.status = 'finished'
    and exists (select 1 from public.match_players x where x.match_id = m.id and x.player_id = a)
    and exists (select 1 from public.match_players y where y.match_id = m.id and y.player_id = b)
$$;

-- Per-game stats for a profile: clears, best and average time, best score.
create or replace function private.player_game_stats(p uuid)
returns table (game_id text, clears integer, best_ms integer, avg_ms integer, best_score integer)
language sql stable security definer set search_path = '' as $$
  select a.game_id, count(*)::int, min(a.time_ms), round(avg(a.time_ms))::int, max(a.score)
  from public.attempts a
  where a.player_id = p and a.status = 'cleared' and a.mode <> 'tutorial'
  group by a.game_id
$$;

-- ---------- leaderboards ----------
-- Ranks one day's verified results for a scope, as seen by p_viewer. p_game null = overall (clears, then total time).
-- Never shows flagged results, banned players, players who lost ranking access, test accounts, or anyone in a
-- block with the viewer. Under-16s never appear on city boards (no city on public boards, SRS 15.2).
create or replace function private.leaderboard(p_viewer uuid, p_game text, p_date date, p_scope text, p_limit integer default 50)
returns table (pos integer, player_id uuid, nickname text, avatar_color text, skin text, hat text, title text, level integer,
               age_band text, value integer, time_ms integer, hints integer, clears integer, total integer, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v public.players; v_crew uuid; v_school_ok boolean; scoring text;
begin
  select * into v from public.players where id = p_viewer;
  select crew_id into v_crew from public.crew_members where crew_members.player_id = p_viewer;
  select s.verified_by is not null into v_school_ok from public.schools s where s.id = v.school_id;
  if p_game is not null then select g.scoring into scoring from public.games g where g.id = p_game; end if;
  return query
  with eligible as (
    select p.* from public.players p
    where p.banned_at is null and not p.ranking_revoked and not p.is_test
      and not exists (select 1 from public.blocks b where (b.player_id = p_viewer and b.blocked_id = p.id) or (b.player_id = p.id and b.blocked_id = p_viewer))
      and case p_scope
        when 'global' then true
        when 'friends' then p.id = p_viewer or p.id in (select private.friend_ids(p_viewer))
        when 'crew' then v_crew is not null and p.id in (select cm.player_id from public.crew_members cm where cm.crew_id = v_crew)
        when 'school' then coalesce(v_school_ok, false) and p.school_id = v.school_id
        when 'city' then v.city is not null and p.city = v.city and p.country = v.country and (p.age_band <> '13-15' or p.id = p_viewer)
        when 'country' then v.country is not null and p.country = v.country
        else false end
  ),
  results as (
    select r.* from public.daily_results r
    join eligible e on e.id = r.player_id
    where r.date = p_date and (p_game is null or r.game_id = p_game)
      and not exists (select 1 from public.attempts a where a.player_id = r.player_id and a.game_id = r.game_id
                      and a.daily_date = r.date and a.mode = 'daily' and a.status = 'flagged')
  ),
  per_player as (
    select r.player_id as pid,
      case when p_game is null then sum(r.time_ms)::int when scoring = 'score' then max(coalesce(r.score, 0)) else min(r.time_ms) end as val,
      sum(r.time_ms)::int as t, sum(r.hints)::int as h, sum(r.mistakes)::int as m, count(*)::int as c, max(r.finished_at) as fin
    from results r group by r.player_id
  ),
  ranked as (
    select pp.*, (rank() over (order by
        case when p_game is null then -pp.c else 0 end,
        case when scoring = 'score' then -pp.val else 0 end,
        pp.t, pp.h, pp.m, pp.fin))::int as rk,
      (count(*) over ())::int as n
    from per_player pp
  )
  select rk.rk, e.id, e.nickname::text, e.avatar_color, e.skin, e.hat, e.title, e.level, e.age_band,
         rk.val, rk.t, rk.h, rk.c, rk.n, e.id = p_viewer
  from ranked rk join eligible e on e.id = rk.pid
  where rk.rk <= p_limit or e.id = p_viewer
  order by rk.rk, e.nickname;
end $$;

-- ---------- leagues ----------
-- A player who clears a Daily midweek joins this week's league straight away ("Clear 1 Daily to join"),
-- in their tier from last week (or Bronze Block), filling the fullest open group first. Test accounts never mix in.
create or replace function private.join_current_league(p_player uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare wk date := date_trunc('week', (now() at time zone 'utc'))::date; lid uuid; t smallint; test boolean; pts integer;
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
  select coalesce((select least(4, greatest(0, l.tier + case lm.result when 'promoted' then 1 when 'demoted' then -1 else 0 end))
                   from public.league_members lm join public.leagues l on l.id = lm.league_id
                   where lm.player_id = p_player and l.week_start = wk - 7), 0) into t;
  select l.id into lid from public.leagues l
    where l.week_start = wk and l.tier = t and l.finalised_at is null
      and (select count(*) from public.league_members m where m.league_id = l.id) < 30
      and not exists (select 1 from public.league_members m join public.players p on p.id = m.player_id
                      where m.league_id = l.id and p.is_test <> test)
    order by (select count(*) from public.league_members m where m.league_id = l.id) desc, l.id
    limit 1;
  if lid is null then
    insert into public.leagues (tier, week_start) values (t, wk) returning id into lid;
  end if;
  select coalesce(sum(amount), 0)::int into pts from public.xp_ledger
    where player_id = p_player and created_at >= wk::timestamp at time zone 'utc';
  insert into public.league_members (league_id, player_id, points) values (lid, p_player, pts);
  return lid;
end $$;

-- ---------- shop ----------
-- Buys one item atomically: unlock checks, Sparks spend (idempotent per request id), then the grant.
-- Raises 'unknown_item', 'locked', 'owned', 'freeze_full' or 'not enough sparks' (all SQLSTATE P0001).
create or replace function private.buy_cosmetic(p_player uuid, p_item text, p_request text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.cosmetics; lvl integer; bal bigint; held smallint; ref text := p_item || ':' || p_request;
begin
  select * into c from public.cosmetics where id = p_item and active;
  if not found then raise exception 'unknown_item'; end if;
  select level, sparks into lvl, bal from public.players where id = p_player for update;
  if lvl is null then raise exception 'unknown player'; end if;
  if exists (select 1 from public.sparks_ledger where player_id = p_player and source = 'shop' and ref_id = ref) then
    return jsonb_build_object('status', 'duplicate', 'sparks', bal);
  end if;
  if c.unlock_level is not null and lvl < c.unlock_level then raise exception 'locked'; end if;
  if c.type not in ('freeze', 'hint_pack') and exists (select 1 from public.inventory where player_id = p_player and cosmetic_id = p_item) then
    raise exception 'owned';
  end if;
  if c.type = 'freeze' then
    insert into public.streaks (player_id) values (p_player) on conflict do nothing;
    select freezes_held into held from public.streaks where player_id = p_player for update;
    if held >= 2 then raise exception 'freeze_full'; end if;
  end if;
  if c.price_sparks > 0 then
    bal := private.spend_sparks(p_player, 'shop', ref, c.price_sparks);
  end if;
  if c.type = 'freeze' then
    update public.streaks set freezes_held = freezes_held + 1, updated_at = now() where player_id = p_player;
  elsif c.type = 'hint_pack' then
    update public.players set practice_hints = practice_hints + coalesce((c.payload ->> 'hints')::int, 5) where id = p_player;
  else
    insert into public.inventory (player_id, cosmetic_id) values (p_player, p_item);
  end if;
  return jsonb_build_object('status', 'bought', 'sparks', bal);
end $$;

-- ---------- crews ----------
create or replace function private.crew_week_xp(p_crew uuid, p_week date) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(x.amount), 0)::int from public.xp_ledger x
  join public.crew_members m on m.player_id = x.player_id and m.crew_id = p_crew
  where x.created_at >= p_week::timestamp at time zone 'utc' and x.created_at < (p_week + 7)::timestamp at time zone 'utc'
$$;

-- Finds or creates this week's clash for a crew: pairs with the unpaired crew closest in size.
create or replace function private.ensure_crew_clash(p_crew uuid, p_week date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid; me_n integer; other uuid;
begin
  select id into cid from public.crew_clashes where week_start = p_week and (crew_a = p_crew or crew_b = p_crew);
  if cid is not null then return cid; end if;
  perform pg_advisory_xact_lock(hashtext('spuzl.crew_clash:' || p_week::text));
  select id into cid from public.crew_clashes where week_start = p_week and (crew_a = p_crew or crew_b = p_crew);
  if cid is not null then return cid; end if;
  select count(*) into me_n from public.crew_members where crew_id = p_crew;
  select c.id into other from public.crews c
    where c.id <> p_crew
      and not exists (select 1 from public.crew_clashes k where k.week_start = p_week and (k.crew_a = c.id or k.crew_b = c.id))
      and exists (select 1 from public.crew_members m where m.crew_id = c.id)
    order by abs((select count(*) from public.crew_members m where m.crew_id = c.id) - me_n), c.created_at
    limit 1;
  if other is null then return null; end if;
  insert into public.crew_clashes (crew_a, crew_b, week_start) values (p_crew, other, p_week) returning id into cid;
  return cid;
end $$;

-- ---------- School Cup ----------
-- Class board: Dailies of the chosen games cleared during the run. More clears first, then less total time.
create or replace function private.school_cup_board(p_cup uuid)
returns table (pos integer, player_id uuid, nickname text, avatar_color text, clears integer, time_ms integer)
language sql stable security definer set search_path = '' as $$
  with cup as (select * from public.school_cups where id = p_cup),
  agg as (
    select m.player_id,
      count(distinct r.game_id) filter (where r.game_id is not null)::int as c,
      coalesce(sum(r.time_ms), 0)::int as t
    from public.school_cup_members m
    cross join cup
    left join public.daily_results r on r.player_id = m.player_id and r.game_id = any (cup.games)
      and r.date between cup.week_start and coalesce(cup.ends_on, cup.week_start + 4)
      and not exists (select 1 from public.attempts a where a.player_id = r.player_id and a.game_id = r.game_id
                      and a.daily_date = r.date and a.mode = 'daily' and a.status = 'flagged')
    where m.cup_id = p_cup
    group by m.player_id
  )
  select (rank() over (order by a.c desc, a.t))::int, p.id, p.nickname::text, p.avatar_color, a.c, a.t
  from agg a join public.players p on p.id = a.player_id and p.banned_at is null
  order by 1, 3
$$;

-- ---------- grants: server entry points only ----------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_friend(uuid), private.in_match(uuid), private.in_league(uuid),
  private.hides_activity(uuid), private.is_blocked_pair(uuid) to authenticated;
grant execute on function private.is_test_player(uuid) to anon, authenticated;

create or replace function public.svc_leaderboard(p_viewer uuid, p_game text, p_date date, p_scope text, p_limit integer default 50)
returns table (pos integer, player_id uuid, nickname text, avatar_color text, skin text, hat text, title text, level integer,
               age_band text, value integer, time_ms integer, hints integer, clears integer, total integer, is_me boolean)
language sql stable security definer set search_path = '' as $$ select * from private.leaderboard(p_viewer, p_game, p_date, p_scope, p_limit) $$;
create or replace function public.svc_join_current_league(p_player uuid) returns uuid
language sql security definer set search_path = '' as $$ select private.join_current_league(p_player) $$;
create or replace function public.svc_buy_cosmetic(p_player uuid, p_item text, p_request text) returns jsonb
language sql security definer set search_path = '' as $$ select private.buy_cosmetic(p_player, p_item, p_request) $$;
create or replace function public.svc_crew_week_xp(p_crew uuid, p_week date) returns integer
language sql stable security definer set search_path = '' as $$ select private.crew_week_xp(p_crew, p_week) $$;
create or replace function public.svc_ensure_crew_clash(p_crew uuid, p_week date) returns uuid
language sql security definer set search_path = '' as $$ select private.ensure_crew_clash(p_crew, p_week) $$;
create or replace function public.svc_school_cup_board(p_cup uuid)
returns table (pos integer, player_id uuid, nickname text, avatar_color text, clears integer, time_ms integer)
language sql stable security definer set search_path = '' as $$ select * from private.school_cup_board(p_cup) $$;
create or replace function public.svc_mutual_counts(p uuid, others uuid[]) returns table (other uuid, n integer)
language sql stable security definer set search_path = '' as $$ select * from private.mutual_counts(p, others) $$;
create or replace function public.svc_duel_record(a uuid, b uuid) returns table (wins_a integer, wins_b integer)
language sql stable security definer set search_path = '' as $$ select * from private.duel_record(a, b) $$;
create or replace function public.svc_player_game_stats(p uuid)
returns table (game_id text, clears integer, best_ms integer, avg_ms integer, best_score integer)
language sql stable security definer set search_path = '' as $$ select * from private.player_game_stats(p) $$;
create or replace function public.svc_friend_ids(p uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select private.friend_ids(p) $$;

revoke execute on function public.svc_leaderboard(uuid, text, date, text, integer), public.svc_join_current_league(uuid),
  public.svc_buy_cosmetic(uuid, text, text), public.svc_crew_week_xp(uuid, date), public.svc_ensure_crew_clash(uuid, date),
  public.svc_school_cup_board(uuid), public.svc_mutual_counts(uuid, uuid[]), public.svc_duel_record(uuid, uuid),
  public.svc_player_game_stats(uuid), public.svc_friend_ids(uuid) from public, anon, authenticated;
grant execute on function public.svc_leaderboard(uuid, text, date, text, integer), public.svc_join_current_league(uuid),
  public.svc_buy_cosmetic(uuid, text, text), public.svc_crew_week_xp(uuid, date), public.svc_ensure_crew_clash(uuid, date),
  public.svc_school_cup_board(uuid), public.svc_mutual_counts(uuid, uuid[]), public.svc_duel_record(uuid, uuid),
  public.svc_player_game_stats(uuid), public.svc_friend_ids(uuid) to service_role;
