-- R2-P5 part B: Azonto Steps, a new lab game (games/azonto): Spuz dances a sequence of Azonto moves to a gentle
-- beat and the player repeats it, one more move each round. Players reach it only while the admin setting
-- "features.labGames" has its id; until then the app hides it and the server refuses it like an unknown game.
--
-- Adds one games row (Arcade, status coming_soon, as scripts/gen-seed.ts writes lab games). min_time_ms is the
-- shortest honest run (a count-in, one demonstrated move, one move back). Nothing else changes.
--
-- Rollback (safe while the game is switched off: no attempts reference it yet):
--   delete from public.games where id = 'azonto';
--   delete from supabase_migrations.schema_migrations where version = '20261205005301';

-- Fresh databases run migrations before the seed (worlds are empty then): insert only when the world exists;
-- supabase/seed.sql adds the row there.
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
select * from (values
  ('azonto', 'reflex', 'Azonto Steps', 'coming_soon', 'M3+', 'custom', 'score', false, 1500, 62)
) as v(id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
where exists (select 1 from public.worlds w where w.id = v.world_id)
on conflict (id) do nothing;
