-- Board Bay "Play live" matchmaking: one waiting entry per player for a live (5 min) game of chess, draughts,
-- oware, ludo or four up. The server pairs two entries of the same game, creates the board_matches row and
-- claims both entries with svc_bay_mm_claim, which refuses to pair players who block each other.
-- Server-only: forced RLS, no grants to anon or authenticated.
--
-- Rollback:
--   drop function if exists public.svc_bay_mm_claim(uuid[], text, uuid);
--   drop table if exists public.board_queue;
--   delete from supabase_migrations.schema_migrations where version = '20261117000001';

create table if not exists public.board_queue (
  player_id uuid primary key references public.players (id) on delete cascade,
  game_id text not null check (game_id in ('chess', 'draughts', 'oware', 'ludo', 'fourup')),
  -- the player's board:<game> rating when they joined; has_rating is false for players with no rated game yet
  rating numeric(7, 2) not null default 1000,
  has_rating boolean not null default false,
  enqueued_at timestamptz not null default now(),
  -- last poll: an entry not seen for a while belongs to a player who left, and is never paired
  seen_at timestamptz not null default now(),
  match_id uuid references public.board_matches (id) on delete set null
);
create index if not exists board_queue_open_idx on public.board_queue (game_id, enqueued_at) where match_id is null;
create index if not exists board_queue_match_idx on public.board_queue (match_id);

alter table public.board_queue enable row level security;
alter table public.board_queue force row level security;
revoke all on public.board_queue from anon, authenticated;
grant all on public.board_queue to service_role;

-- Pairs waiting entries atomically: every player must still be waiting for p_game, and no two of them may block
-- each other (either way round). Otherwise nothing changes and it returns false.
create or replace function public.svc_bay_mm_claim(p_players uuid[], p_game text, p_match uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if array_length(p_players, 1) is null or array_length(p_players, 1) < 2 then return false; end if;
  perform 1 from public.board_queue
    where player_id = any (p_players) and game_id = p_game and match_id is null
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

revoke execute on function public.svc_bay_mm_claim(uuid[], text, uuid) from public, anon, authenticated;
grant execute on function public.svc_bay_mm_claim(uuid[], text, uuid) to service_role;
