-- Phase 5 lab game: Penalty King (Reflex Rink). Behind the "features.newGames" admin setting: the app hides
-- it and the server refuses it while that is off (lib/catalog.ts LAB_GAMES, lib/game/service.ts).
-- Rollback: delete from public.games where id = 'penalty';  (safe: no attempts while the flag is off)
-- Fresh databases run migrations before the seed (worlds are empty then): insert only when the world exists;
-- the seed adds the same row there.
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
select * from (values
  ('penalty', 'reflex', 'Penalty King', 'coming_soon', 'M3+', 'custom', 'score', false, 0, 51)
) as v(id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
where exists (select 1 from public.worlds w where w.id = v.world_id)
on conflict (id) do nothing;
