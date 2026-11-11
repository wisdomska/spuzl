-- Party size up to 10 (owner, 11 Nov 2026). Admins pick the largest room hosts may open with the game setting
-- "party.maxPlayers" (2 to 10, default 8). The app checks the setting; this check is the hard ceiling, sized for the
-- Supabase free plan's Realtime budget (about 100 messages a second: one room of 10 racers at one update a second
-- each is about 100 deliveries a second). Rooms already open keep the size they were made with.
--
-- Rollback (rooms larger than 8 must close or shrink first):
--   update public.matches set max_players = 8 where max_players > 8;
--   alter table public.matches drop constraint matches_max_players_check;
--   alter table public.matches add constraint matches_max_players_check check (max_players between 2 and 8);

alter table public.matches drop constraint matches_max_players_check;
alter table public.matches add constraint matches_max_players_check check (max_players between 2 and 10);
