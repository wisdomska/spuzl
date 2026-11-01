-- Phase 5 lab game: Trotro Jam (Shape Shed), behind the admin setting "features.newGames".
-- 'coming_soon' keeps it readable (attempts reference it) but out of the live-game Daily checks.
-- Rollback: delete from public.games where id = 'trotro';
-- Fresh databases run migrations before the seed (worlds are empty then): insert only when the world exists;
-- the seed adds the same row there.
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
select * from (values
  ('trotro', 'shape', 'Trotro Jam', 'coming_soon', 'M3+', 'grid', 'time', false, 5000, 57)
) as v(id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
where exists (select 1 from public.worlds w where w.id = v.world_id)
on conflict (id) do nothing;
