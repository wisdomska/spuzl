-- Board Bay live time controls: players pick the minutes per player (chess and draughts 3/5/10/15/30, others fewer;
-- lib/multiplayer/bay CLOCK_MINUTES). A match keeps its control for rematches, and Play live only pairs players who
-- picked the same one.
--
-- Rollback:
--   drop function if exists public.svc_bay_mm_claim_timed(uuid[], text, integer, uuid);
--   drop index if exists public.board_queue_open_clock_idx;
--   alter table public.board_queue drop column if exists clock_ms;
--   alter table public.board_matches drop column if exists clock_base_ms;
--   delete from supabase_migrations.schema_migrations where version = '20261123000001';

-- The time control each player started with (ms); null for async games and for live games made before this (5 min).
alter table public.board_matches add column if not exists clock_base_ms integer
  check (clock_base_ms is null or clock_base_ms between 60000 and 3600000);

-- The time control a waiting player asked for; existing entries were all 5 minute searches.
alter table public.board_queue add column if not exists clock_ms integer not null default 300000
  check (clock_ms between 60000 and 3600000);
create index if not exists board_queue_open_clock_idx on public.board_queue (game_id, clock_ms, enqueued_at) where match_id is null;

-- Like svc_bay_mm_claim, but every player must also still be waiting for the same time control.
create or replace function public.svc_bay_mm_claim_timed(p_players uuid[], p_game text, p_clock integer, p_match uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if array_length(p_players, 1) is null or array_length(p_players, 1) < 2 then return false; end if;
  perform 1 from public.board_queue
    where player_id = any (p_players) and game_id = p_game and clock_ms = p_clock and match_id is null
    for update skip locked;
  get diagnostics n = row_count;
  if n <> array_length(p_players, 1) then return false; end if;
  if exists (
    select 1 from public.blocks
    where player_id = any (p_players) and blocked_id = any (p_players) and player_id <> blocked_id
  ) then
    return false;
  end if;
  update public.board_queue set match_id = p_match where player_id = any (p_players);
  return true;
end $$;

revoke execute on function public.svc_bay_mm_claim_timed(uuid[], text, integer, uuid) from public, anon, authenticated;
grant execute on function public.svc_bay_mm_claim_timed(uuid[], text, integer, uuid) to service_role;
