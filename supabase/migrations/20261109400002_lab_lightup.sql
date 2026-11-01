-- Phase 5 lab game: Light Up (Logic Lab), behind the admin setting "features.newGames".
-- 'coming_soon' keeps it readable (attempts reference it) but out of the live-game Daily checks.
-- Rollback: delete from public.games where id = 'lightup';
-- Fresh databases run migrations before the seed (worlds are empty then): insert only when the world exists;
-- the seed adds the same row there.
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
select * from (values
  ('lightup', 'logic', 'Light Up', 'coming_soon', 'M3+', 'grid', 'time', true, 8000, 58)
) as v(id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
where exists (select 1 from public.worlds w where w.id = v.world_id)
on conflict (id) do nothing;
