-- Phase 5 lab game: Dara (Board Bay), West African three-in-a-row: puzzles plus a full game vs bot.
-- Hidden and refused by the server while the "features.newGames" setting is off (lib/catalog.ts LAB_GAMES).
-- Rollback (safe: there are no attempts while the flag is off):
--   delete from public.games where id = 'dara';
-- Fresh databases run migrations before the seed (worlds are empty then): insert only when the world exists;
-- the seed adds the same row there.
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
select * from (values
  ('dara', 'board', 'Dara', 'coming_soon', 'M3+', 'board', 'time', true, 1500, 60)
) as v(id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
where exists (select 1 from public.worlds w where w.id = v.world_id)
on conflict (id) do nothing;
