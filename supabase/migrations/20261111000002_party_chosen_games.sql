-- Party rooms: the host can hand-pick several games. matches.games is the per-round list the race start writes
-- (and "Run it back" clears), so the host's picks need a column of their own that survives every set.
-- chosen_games: the picked race games (empty: one game in game_id, or a random mix). The rooms API validates
-- each id against the race games and the 2 to 8 range; the check here only bounds the size and keeps it clean.
-- Writes go through the service role only (RLS forced; anon and authenticated have no write grants on matches).
--
-- Rollback:
--   alter table public.matches drop constraint if exists matches_chosen_games_check;
--   alter table public.matches drop column if exists chosen_games;

alter table public.matches add column if not exists chosen_games text[] not null default '{}';
alter table public.matches drop constraint if exists matches_chosen_games_check;
alter table public.matches add constraint matches_chosen_games_check
  check (cardinality(chosen_games) <= 8 and array_position(chosen_games, null) is null);

alter table public.matches enable row level security;
alter table public.matches force row level security;
revoke insert, update, delete, truncate on public.matches from anon, authenticated;
