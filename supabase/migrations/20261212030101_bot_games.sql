-- Games against the bot on a player's record (owner, 12 Nov 2026: "let them show, except practice rounds").
-- /play/<game>/bot was casual and sent nothing to the server; each finished game now leaves one row: the game, the
-- bot's level, won/lost/draw and how long it took. No XP, Sparks or rating (nothing to farm), and practice rounds
-- still leave nothing. The admin player page lists them under Games; the data export includes them; deleting the
-- player deletes them.
--
-- Server-only, like feedback: RLS forced with no client policies, and no client grants. Only the API route
-- (service role, after checking the signed-in player) writes, and only the admin API and the export read.
--
-- Rollback:
--   drop table if exists public.bot_games;

create table public.bot_games (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  game_id text not null check (game_id in ('fourup', 'draughts', 'oware', 'flip', 'chess', 'ludo', 'dara')),
  level text not null check (level in ('easy', 'medium', 'hard')),
  outcome text not null check (outcome in ('won', 'lost', 'draw')),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 86400000),
  created_at timestamptz not null default now()
);

create index bot_games_player_created on public.bot_games (player_id, created_at desc);

alter table public.bot_games enable row level security;
alter table public.bot_games force row level security;
revoke all on public.bot_games from anon, authenticated;
