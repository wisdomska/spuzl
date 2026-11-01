-- Phase 5 lab game: Dara (Board Bay), West African three-in-a-row: puzzles plus a full game vs bot.
-- Hidden and refused by the server while the "features.newGames" setting is off (lib/catalog.ts LAB_GAMES).
-- Rollback (safe: there are no attempts while the flag is off):
--   delete from public.games where id = 'dara';
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort) values
  ('dara', 'board', 'Dara', 'coming_soon', 'M3+', 'board', 'time', true, 1500, 60)
on conflict (id) do nothing;
