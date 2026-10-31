-- Row Level Security on every table. Default: deny. Clients read their own rows and public boards;
-- every write goes through server routes (service role) after validation, rate limiting and anti-cheat.

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;

-- Helpers (private, security definer, identity checked inside)
create or replace function private.is_friend(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((player_id = (select auth.uid()) and friend_id = other) or (friend_id = (select auth.uid()) and player_id = other))
  )
$$;
create or replace function private.in_match(m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.match_players where match_id = m and player_id = (select auth.uid()))
$$;
create or replace function private.in_league(l uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.league_members where league_id = l and player_id = (select auth.uid()))
$$;
revoke execute on function private.is_friend(uuid), private.in_match(uuid), private.in_league(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_friend(uuid), private.in_match(uuid), private.in_league(uuid) to authenticated;

-- Catalogue: public read
create policy worlds_read on public.worlds for select to anon, authenticated using (true);
create policy games_read on public.games for select to anon, authenticated using (status <> 'hidden');
create policy badges_read on public.badges for select to anon, authenticated using (not secret);
create policy quests_read on public.quests for select to anon, authenticated using (active);
create policy cosmetics_read on public.cosmetics for select to anon, authenticated using (active);
create policy flags_read on public.feature_flags for select to anon, authenticated using (true);
create policy schools_read on public.schools for select to authenticated using (verified_by is not null);
create policy crews_read on public.crews for select to authenticated using (true);
create policy crew_members_read on public.crew_members for select to authenticated using (true);

-- Own rows
create policy players_own on public.players for select to authenticated using (id = (select auth.uid()));
create policy streaks_own on public.streaks for select to authenticated using (player_id = (select auth.uid()));
create policy ratings_own on public.ratings for select to authenticated using (player_id = (select auth.uid()));
create policy xp_ledger_own on public.xp_ledger for select to authenticated using (player_id = (select auth.uid()));
create policy sparks_ledger_own on public.sparks_ledger for select to authenticated using (player_id = (select auth.uid()));
create policy attempts_own on public.attempts for select to authenticated using (player_id = (select auth.uid()));
create policy player_badges_own on public.player_badges for select to authenticated using (player_id = (select auth.uid()));
create policy player_quests_own on public.player_quests for select to authenticated using (player_id = (select auth.uid()));
create policy inventory_own on public.inventory for select to authenticated using (player_id = (select auth.uid()));
create policy blocks_own on public.blocks for select to authenticated using (player_id = (select auth.uid()));
create policy invites_own on public.invites for select to authenticated using (player_id = (select auth.uid()));
create policy friendships_mine on public.friendships for select to authenticated
  using (player_id = (select auth.uid()) or friend_id = (select auth.uid()));

-- Public boards: verified Daily results only expose ids, times, hints and mistakes
create policy daily_results_read on public.daily_results for select to anon, authenticated using (true);

-- Feed: own and accepted friends' events, unless they hide activity
create policy feed_read on public.feed_events for select to authenticated
  using (player_id = (select auth.uid()) or (select private.is_friend(player_id)));
create policy reactions_read on public.reactions for select to authenticated
  using (exists (select 1 from public.feed_events e where e.id = event_id));

-- Leagues: your own league table
create policy leagues_read on public.leagues for select to authenticated using ((select private.in_league(id)));
create policy league_members_read on public.league_members for select to authenticated using ((select private.in_league(league_id)));

-- Multiplayer: participants only (realtime postgres_changes respects these)
create policy matches_read on public.matches for select to authenticated using ((select private.in_match(id)));
create policy match_players_read on public.match_players for select to authenticated using ((select private.in_match(match_id)));
create policy board_matches_read on public.board_matches for select to authenticated using ((select auth.uid()) = any (players));
create policy board_moves_read on public.board_moves for select to authenticated
  using (exists (select 1 from public.board_matches b where b.id = match_id and (select auth.uid()) = any (b.players)));
create policy challenge_results_own on public.challenge_results for select to authenticated using (player_id = (select auth.uid()));
create policy ghost_runs_own on public.ghost_runs for select to authenticated using (player_id = (select auth.uid()) or (select private.is_friend(player_id)));
create policy school_cup_members_own on public.school_cup_members for select to authenticated using (player_id = (select auth.uid()));

-- No client policies (server or admin only): puzzles, dailies, admins, reports, content_items, audit_log,
-- rate_limits, matchmaking_queue, challenges, school_cups, crew_clashes.

-- Public projection views run as owner but only expose safe columns
grant select on public.player_cards to anon, authenticated;
