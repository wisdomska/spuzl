-- Multiplayer: Duels, Party Races, async challenges, Ghost Races and Board Bay matches.
-- The server decides every result. Clients only read their own matches (RLS) and talk to each other
-- over private Realtime channels (one per match or room) whose access is checked against membership.

-- ---------- matches (duels and races) ----------
alter table public.matches
  add column difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard', 'expert')),
  add column games text[] not null default '{}', -- game id per round (Duel rounds, Party games)
  add column max_players smallint not null default 8 check (max_players between 2 and 8),
  add column classroom boolean not null default false,
  add column rated boolean not null default false,
  add column set_no smallint not null default 1, -- "Run it back" starts a new set with fresh puzzles
  add column pause_ms integer not null default 0 check (pause_ms >= 0),
  add column paused_at timestamptz,
  add column round_first_at timestamptz, -- first verified finish of the current round
  add column bot_ms integer[] not null default '{}', -- Practice bot finish time per round
  add column bot_rounds_won smallint not null default 0,
  add column result text, -- win, draw, abandon, timeout
  add column rematch_id uuid references public.matches(id) on delete set null,
  add column updated_at timestamptz not null default now();
create index matches_host_idx on public.matches (host_id);
create index matches_winner_idx on public.matches (winner_id);
create index matches_rematch_idx on public.matches (rematch_id);
create index matches_emptied_idx on public.matches (emptied_at) where emptied_at is not null;

alter table public.match_players
  add column seat smallint not null default 0,
  add column state jsonb,
  add column points integer not null default 0,
  add column spectator boolean not null default false,
  add column rematch boolean not null default false,
  add column joined_at timestamptz not null default now();

-- Per round (Duel) or per game (Party) results. Times are server times, never client clocks.
create table public.match_rounds (
  match_id uuid not null references public.matches(id) on delete cascade,
  set_no smallint not null default 1,
  round smallint not null,
  player_id uuid not null references public.players(id) on delete cascade,
  game_id text references public.games(id),
  time_ms integer check (time_ms is null or time_ms >= 0),
  mistakes smallint not null default 0,
  progress numeric(4, 3) not null default 0,
  place smallint,
  points integer not null default 0,
  won boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (match_id, set_no, round, player_id)
);
create index match_rounds_player_idx on public.match_rounds (player_id);
create index match_rounds_game_idx on public.match_rounds (game_id);

-- Queue: null game = any game. match_id is set when the server pairs two entries.
alter table public.matchmaking_queue alter column game_id drop not null;
alter table public.matchmaking_queue add column match_id uuid references public.matches(id) on delete set null;
create index matchmaking_queue_open_idx on public.matchmaking_queue (enqueued_at) where match_id is null;
create index matchmaking_queue_match_idx on public.matchmaking_queue (match_id);

-- ---------- Board Bay ----------
alter table public.board_matches
  add column invite_code text unique,
  add column seats smallint not null default 2 check (seats between 2 and 4),
  add column rated boolean not null default false,
  add column bot boolean not null default false,
  add column ply integer not null default 0,
  add column seed text not null default gen_random_uuid()::text,
  add column clock_ms integer[], -- live: remaining ms per seat; null for async
  add column turn_started_at timestamptz,
  add column draw_offer smallint, -- seat that offered a draw
  add column takeback_offer smallint, -- seat that asked for a takeback
  add column rematch_id uuid references public.board_matches(id) on delete set null,
  add column created_by uuid references public.players(id) on delete set null;
create index board_matches_creator_idx on public.board_matches (created_by);
create index board_matches_winner_idx on public.board_matches (winner_id);
create index board_matches_rematch_idx on public.board_matches (rematch_id);
create index board_moves_player_idx on public.board_moves (player_id);

-- ---------- challenges and ghosts ----------
alter table public.challenges
  add column attempt_id uuid references public.attempts(id) on delete set null,
  add column daily_date date,
  add column hints smallint not null default 0,
  add column mistakes smallint not null default 0;
create index challenges_sender_idx on public.challenges (sender_id);
create index challenges_attempt_idx on public.challenges (attempt_id);
alter table public.challenge_results
  add column attempt_id uuid references public.attempts(id) on delete set null,
  add column hints smallint not null default 0,
  add column mistakes smallint not null default 0,
  add column timeline jsonb;
create index challenge_results_player_idx on public.challenge_results (player_id);

alter table public.ghost_runs
  add column attempt_id uuid unique references public.attempts(id) on delete set null,
  add column puzzle_id uuid references public.puzzles(id) on delete set null;
create index ghost_runs_puzzle_idx on public.ghost_runs (puzzle_id, time_ms);

-- ---------- RLS on the new table ----------
alter table public.match_rounds enable row level security;
alter table public.match_rounds force row level security;
revoke insert, update, delete, truncate on public.match_rounds from anon, authenticated;
create policy match_rounds_read on public.match_rounds for select to authenticated using ((select private.in_match(match_id)));

-- ---------- Realtime authorisation (private channels) ----------
-- Topics: match:<uuid> (Duel and Party room), bay:<uuid> (Board Bay match), user:<uuid> (your own inbox).
create or replace function private.can_use_topic(t text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare tid uuid; kind text := split_part(t, ':', 1);
begin
  begin
    tid := split_part(t, ':', 2)::uuid;
  exception when others then
    return false;
  end;
  if kind = 'match' then
    return exists (select 1 from public.match_players where match_id = tid and player_id = (select auth.uid()) and left_at is null);
  elsif kind = 'bay' then
    return exists (select 1 from public.board_matches where board_matches.id = tid and (select auth.uid()) = any (players));
  elsif kind = 'user' then
    return tid = (select auth.uid());
  end if;
  return false;
end $$;
revoke execute on function private.can_use_topic(text) from public, anon;
grant execute on function private.can_use_topic(text) to authenticated;

drop policy if exists spuzl_realtime_read on realtime.messages;
drop policy if exists spuzl_realtime_write on realtime.messages;
create policy spuzl_realtime_read on realtime.messages for select to authenticated
  using ((select private.can_use_topic((select realtime.topic()))));
create policy spuzl_realtime_write on realtime.messages for insert to authenticated
  with check ((select private.can_use_topic((select realtime.topic()))));

-- ---------- Service functions (service_role only) ----------

-- Pairs queue entries atomically: every player must still be waiting, otherwise nothing changes.
create or replace function public.svc_mm_claim(p_players uuid[], p_match uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform 1 from public.matchmaking_queue where player_id = any (p_players) and match_id is null for update skip locked;
  get diagnostics n = row_count;
  if n <> array_length(p_players, 1) then return false; end if;
  update public.matchmaking_queue set match_id = p_match where player_id = any (p_players);
  return true;
end $$;

-- Records a verified finish with the database clock. Returns the finish time and the round's first finish.
create or replace function public.svc_match_finish(p_match uuid, p_round smallint, p_player uuid, p_mistakes integer)
returns table (time_ms integer, first_ms integer, accepted boolean)
language plpgsql security definer set search_path = '' as $$
declare m public.matches; t integer; existing integer; g text;
begin
  select * into m from public.matches where id = p_match for update;
  if m.id is null or m.status <> 'playing' or m.round <> p_round or clock_timestamp() < m.round_started_at then
    return query select null::integer, null::integer, false; return;
  end if;
  select r.time_ms into existing from public.match_rounds r
    where r.match_id = p_match and r.set_no = m.set_no and r.round = p_round and r.player_id = p_player;
  if existing is not null then
    t := existing;
  else
    t := greatest(0, (extract(epoch from (clock_timestamp() - m.round_started_at)) * 1000)::integer - m.pause_ms);
    g := m.games[p_round];
    insert into public.match_rounds (match_id, set_no, round, player_id, game_id, time_ms, mistakes, progress)
      values (p_match, m.set_no, p_round, p_player, g, t, least(p_mistakes, 32000), 1)
      on conflict (match_id, set_no, round, player_id) do update set time_ms = excluded.time_ms, mistakes = excluded.mistakes, progress = 1;
    update public.match_players set finished_ms = t, progress = 1, last_seen_at = now() where match_id = p_match and player_id = p_player;
    if m.round_first_at is null then update public.matches set round_first_at = clock_timestamp() where id = p_match; end if;
  end if;
  return query select t, (select min(r.time_ms) from public.match_rounds r
    where r.match_id = p_match and r.set_no = m.set_no and r.round = p_round and r.time_ms is not null), true;
end $$;

-- Applies a round decision computed by the app, once: only when the match is still in the expected
-- status and round. p_players: [{player_id, rounds_won, points, place}], p_rounds: [{player_id, game_id,
-- time_ms, mistakes, progress, place, points, won}]. Returns false when another request already applied it.
create or replace function public.svc_match_commit(
  p_match uuid, p_expect_status text, p_expect_round smallint,
  p_status text, p_round smallint, p_round_started_at timestamptz, p_winner uuid, p_result text,
  p_bot_rounds_won smallint, p_players jsonb, p_rounds jsonb
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare m public.matches; r jsonb;
begin
  select * into m from public.matches where id = p_match for update;
  if m.id is null or m.status <> p_expect_status or m.round <> p_expect_round then return false; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rounds, '[]'::jsonb)) loop
    insert into public.match_rounds (match_id, set_no, round, player_id, game_id, time_ms, mistakes, progress, place, points, won)
    values (p_match, m.set_no, p_expect_round, (r->>'player_id')::uuid, r->>'game_id', (r->>'time_ms')::integer,
      coalesce((r->>'mistakes')::smallint, 0), coalesce((r->>'progress')::numeric, 0), (r->>'place')::smallint,
      coalesce((r->>'points')::integer, 0), coalesce((r->>'won')::boolean, false))
    on conflict (match_id, set_no, round, player_id) do update set
      time_ms = coalesce(excluded.time_ms, public.match_rounds.time_ms), mistakes = excluded.mistakes,
      progress = greatest(excluded.progress, public.match_rounds.progress), place = excluded.place, points = excluded.points, won = excluded.won;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_players, '[]'::jsonb)) loop
    update public.match_players set
      rounds_won = coalesce((r->>'rounds_won')::smallint, rounds_won),
      points = coalesce((r->>'points')::integer, points),
      place = coalesce((r->>'place')::smallint, place)
    where match_id = p_match and player_id = (r->>'player_id')::uuid;
  end loop;
  -- A new round starts clean for everyone.
  if p_round <> p_expect_round then
    update public.match_players set progress = 0, mistakes = 0, finished_ms = null, state = null where match_id = p_match;
  end if;
  update public.matches set status = p_status, round = p_round, round_started_at = coalesce(p_round_started_at, round_started_at),
    round_first_at = case when p_round <> p_expect_round then null else round_first_at end,
    winner_id = coalesce(p_winner, winner_id), result = coalesce(p_result, result),
    bot_rounds_won = coalesce(p_bot_rounds_won, bot_rounds_won),
    finished_at = case when p_status = 'finished' then now() else finished_at end,
    paused_at = null, updated_at = now()
  where id = p_match;
  return true;
end $$;

-- Board Bay: applies one validated move. The ply must be the current one, so two requests can never
-- both move; the move log and the match row change together.
create or replace function public.svc_bay_commit(
  p_match uuid, p_ply integer, p_player uuid, p_move jsonb, p_state jsonb, p_turn smallint,
  p_status text, p_winner uuid, p_result text, p_deadline timestamptz, p_clock integer[]
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare b public.board_matches;
begin
  select * into b from public.board_matches where id = p_match for update;
  if b.id is null or b.status <> 'active' or b.ply <> p_ply then return false; end if;
  insert into public.board_moves (match_id, ply, player_id, move) values (p_match, p_ply, p_player, p_move);
  update public.board_matches set state = p_state, turn = p_turn, ply = p_ply + 1, status = p_status,
    winner_id = p_winner, result = p_result, move_deadline = p_deadline, nudged_at = null,
    clock_ms = coalesce(p_clock, clock_ms), turn_started_at = now(), draw_offer = null, takeback_offer = null, updated_at = now()
  where id = p_match;
  return true;
end $$;

-- Board Bay takeback: rewinds to p_ply (state recomputed by the app from the move log).
create or replace function public.svc_bay_rewind(p_match uuid, p_from_ply integer, p_to_ply integer, p_state jsonb, p_turn smallint, p_deadline timestamptz)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare b public.board_matches;
begin
  select * into b from public.board_matches where id = p_match for update;
  if b.id is null or b.status <> 'active' or b.ply <> p_from_ply or p_to_ply < 0 or p_to_ply >= p_from_ply then return false; end if;
  delete from public.board_moves where match_id = p_match and ply >= p_to_ply;
  update public.board_matches set state = p_state, turn = p_turn, ply = p_to_ply, takeback_offer = null, draw_offer = null,
    move_deadline = p_deadline, turn_started_at = now(), updated_at = now()
  where id = p_match;
  return true;
end $$;

-- Async moves expire after 24 h: the player to move loses. Runs every 15 minutes.
create or replace function private.bay_expire() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with x as (
    update public.board_matches set status = 'finished', result = 'timeout',
      winner_id = case when seats = 2 then players[(1 - turn) + 1] else null end, updated_at = now()
    where status = 'active' and move_deadline is not null and move_deadline < now() returning 1
  ) select count(*) into n from x;
  return n;
end $$;

revoke execute on function public.svc_mm_claim(uuid[], uuid), public.svc_match_finish(uuid, smallint, uuid, integer),
  public.svc_match_commit(uuid, text, smallint, text, smallint, timestamptz, uuid, text, smallint, jsonb, jsonb),
  public.svc_bay_commit(uuid, integer, uuid, jsonb, jsonb, smallint, text, uuid, text, timestamptz, integer[]),
  public.svc_bay_rewind(uuid, integer, integer, jsonb, smallint, timestamptz), private.bay_expire()
  from public, anon, authenticated;
grant execute on function public.svc_mm_claim(uuid[], uuid), public.svc_match_finish(uuid, smallint, uuid, integer),
  public.svc_match_commit(uuid, text, smallint, text, smallint, timestamptz, uuid, text, smallint, jsonb, jsonb),
  public.svc_bay_commit(uuid, integer, uuid, jsonb, jsonb, smallint, text, uuid, text, timestamptz, integer[]),
  public.svc_bay_rewind(uuid, integer, integer, jsonb, smallint, timestamptz)
  to service_role;

select cron.schedule('spuzl-bay-expire', '*/15 * * * *', $$select private.bay_expire()$$);
