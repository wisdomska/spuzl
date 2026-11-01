-- Phase 5 lab game: Penalty King (Reflex Rink). Behind the "features.newGames" admin setting: the app hides
-- it and the server refuses it while that is off (lib/catalog.ts LAB_GAMES, lib/game/service.ts).
-- Rollback: delete from public.games where id = 'penalty';  (safe: no attempts while the flag is off)
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort) values
  ('penalty', 'reflex', 'Penalty King', 'live', 'M3+', 'custom', 'score', false, 0, 51)
on conflict (id) do nothing;
