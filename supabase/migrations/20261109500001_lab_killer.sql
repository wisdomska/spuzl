-- Phase 5 lab game: Killer Sums (Number Den), killer sudoku on the shared sudoku board.
-- Hidden and refused by the server while the "features.newGames" setting is off (lib/catalog.ts LAB_GAMES).
-- Rollback (safe: there are no attempts while the flag is off):
--   delete from public.games where id = 'killer';
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort) values
  ('killer', 'number', 'Killer Sums', 'coming_soon', 'M3+', 'grid', 'time', true, 15000, 59)
on conflict (id) do nothing;
