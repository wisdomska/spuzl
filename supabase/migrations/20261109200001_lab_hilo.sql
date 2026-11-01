-- Phase 5 lab game: Higher or Lower (Number Den). Behind the admin setting "features.newGames"; the server refuses it
-- while the setting is off. Status coming_soon: no Dailies are scheduled for lab games, so the rollover's missing-Daily
-- count and the live-ops gap alert (both read status = 'live') leave it out.
-- Rollback:
--   delete from public.games where id = 'hilo';
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort) values
  ('hilo', 'number', 'Higher or Lower', 'coming_soon', 'M3+', 'custom', 'score', false, 6000, 53)
on conflict (id) do nothing;
