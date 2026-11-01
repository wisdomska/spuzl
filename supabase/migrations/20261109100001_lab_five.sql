-- Phase 5 lab game: Five (Word Woods). The app hides it and the server refuses it while the admin setting
-- "features.newGames" is off. Status 'coming_soon' keeps the row readable (RLS hides only 'hidden') while
-- leaving it out of the daily rollover's missing-Dailies count, since lab games have no scheduled Dailies.
-- Rollback: delete from public.games where id = 'five';
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort) values
  ('five', 'word', 'Five', 'coming_soon', 'M3+', 'word', 'time', false, 4000, 55)
on conflict (id) do nothing;
