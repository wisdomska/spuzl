-- R3-08: Party score races. Score games (Quickfire, Emoji Hits, Two Truths and a Lie...) can be raced in a Party:
-- everyone plays the same seeded round, most points wins, then the faster finish. The server judges them as in solo
-- play, so it keeps, per player and round:
--   * public.match_race_logs: the answers the server judged through the guess transport (the solo attempt's move
--     log, for a race round). Appended only by svc_race_log. No client access at all (RLS forced, no policy, no
--     grants), so a rival can never read what someone else was told.
--   * match_rounds.score: the points the server gave the run (null for time races).
-- svc_match_commit is redefined: the same as 20261101000001 plus `score` on round rows.
--
-- Rollback:
--   (re-run the svc_match_commit definition from 20261101000001_multiplayer.sql)
--   drop function if exists public.svc_race_log(uuid, uuid, smallint, integer, jsonb);
--   drop table if exists public.match_race_logs;
--   alter table public.match_rounds drop column if exists score;
--   delete from supabase_migrations.schema_migrations where version = '20261207000801';

alter table public.match_rounds add column if not exists score integer;

create table if not exists public.match_race_logs (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  set_no smallint not null,
  round smallint not null,
  log jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id, set_no, round)
);
create index if not exists match_race_logs_player_idx on public.match_race_logs (player_id);
alter table public.match_race_logs enable row level security;
alter table public.match_race_logs force row level security;
revoke all on public.match_race_logs from public, anon, authenticated;

-- Appends one judged entry to a racer's log for the current round of a playing match. `p_len` is the log length the
-- caller read: when another request appended meanwhile nothing changes (false), so nothing is answered twice.
create or replace function public.svc_race_log(p_match uuid, p_player uuid, p_round smallint, p_len integer, p_entry jsonb)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare m public.matches; n integer;
begin
  if jsonb_typeof(p_entry) is distinct from 'object' or p_len < 0 or p_len >= 200 then return false; end if;
  select * into m from public.matches where id = p_match;
  if m.id is null or m.status <> 'playing' or m.round <> p_round then return false; end if;
  perform 1 from public.match_players
    where match_id = p_match and player_id = p_player and not spectator and left_at is null;
  if not found then return false; end if;
  if p_len = 0 then
    insert into public.match_race_logs (match_id, player_id, set_no, round, log)
      values (p_match, p_player, m.set_no, p_round, jsonb_build_array(p_entry))
      on conflict (match_id, player_id, set_no, round) do nothing;
  else
    update public.match_race_logs set log = log || jsonb_build_array(p_entry), updated_at = now()
      where match_id = p_match and player_id = p_player and set_no = m.set_no and round = p_round
        and jsonb_array_length(log) = p_len;
  end if;
  get diagnostics n = row_count;
  return n = 1;
end $$;

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
    insert into public.match_rounds (match_id, set_no, round, player_id, game_id, time_ms, mistakes, progress, place, points, won, score)
    values (p_match, m.set_no, p_expect_round, (r->>'player_id')::uuid, r->>'game_id', (r->>'time_ms')::integer,
      coalesce((r->>'mistakes')::smallint, 0), coalesce((r->>'progress')::numeric, 0), (r->>'place')::smallint,
      coalesce((r->>'points')::integer, 0), coalesce((r->>'won')::boolean, false), (r->>'score')::integer)
    on conflict (match_id, set_no, round, player_id) do update set
      time_ms = coalesce(excluded.time_ms, public.match_rounds.time_ms), mistakes = excluded.mistakes,
      progress = greatest(excluded.progress, public.match_rounds.progress), place = excluded.place, points = excluded.points, won = excluded.won,
      score = coalesce(excluded.score, public.match_rounds.score);
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

revoke execute on function public.svc_race_log(uuid, uuid, smallint, integer, jsonb),
  public.svc_match_commit(uuid, text, smallint, text, smallint, timestamptz, uuid, text, smallint, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.svc_race_log(uuid, uuid, smallint, integer, jsonb),
  public.svc_match_commit(uuid, text, smallint, text, smallint, timestamptz, uuid, text, smallint, jsonb, jsonb)
  to service_role;
