-- Learned games per account (guided first play). A player who finishes or skips a game's guided practice round
-- has learned it; until now only the device remembered that (localStorage "spuzl.learned"), so a new device
-- replayed the practice round. public.learned_games keeps it with the account, alongside cleared games
-- (public.attempts). Written only by the API with the service role (POST /api/v1/me/learned, game checked against
-- the catalog there); players may read their own rows. Ranked Duels also count a learned game as known (no rules
-- break for it).
-- Rollback:
--   drop table if exists public.learned_games;
--   delete from supabase_migrations.schema_migrations where version = '20261111100001';

create table if not exists public.learned_games (
  player_id uuid not null references public.players (id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9-]{2,24}$'),
  learned_at timestamptz not null default now(),
  primary key (player_id, game_id)
);

alter table public.learned_games enable row level security;
alter table public.learned_games force row level security;
revoke all on public.learned_games from anon, authenticated;
grant select on public.learned_games to authenticated;
drop policy if exists learned_games_own on public.learned_games;
create policy learned_games_own on public.learned_games for select to authenticated
  using (player_id = (select auth.uid()));
