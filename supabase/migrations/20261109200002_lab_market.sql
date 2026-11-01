-- Phase 5 lab game: Market Run (Number Den). Behind the admin setting "features.newGames"; the server refuses it
-- while the setting is off. Status coming_soon: no Dailies are scheduled for lab games, so the rollover's missing-Daily
-- count and the live-ops gap alert (both read status = 'live') leave it out.
-- Rollback:
--   delete from public.games where id = 'market';
-- Fresh databases run migrations before the seed (worlds are empty then): insert only when the world exists;
-- the seed adds the same row there.
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
select * from (values
  ('market', 'number', 'Market Run', 'coming_soon', 'M3+', 'custom', 'time', true, 8000, 54)
) as v(id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
where exists (select 1 from public.worlds w where w.id = v.world_id)
on conflict (id) do nothing;
