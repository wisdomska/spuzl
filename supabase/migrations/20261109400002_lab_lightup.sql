-- Phase 5 lab game: Light Up (Logic Lab), behind the admin setting "features.newGames".
-- 'coming_soon' keeps it readable (attempts reference it) but out of the live-game Daily checks.
-- Rollback: delete from public.games where id = 'lightup';
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort) values
  ('lightup', 'logic', 'Light Up', 'coming_soon', 'M3+', 'grid', 'time', true, 8000, 58)
on conflict (id) do nothing;
