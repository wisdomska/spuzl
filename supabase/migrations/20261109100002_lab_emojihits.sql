-- Phase 5 lab game: Emoji Hits (Clue Cave). The app hides it and the server refuses it while the admin setting
-- "features.newGames" is off. Status 'coming_soon' keeps the row readable (RLS hides only 'hidden') while
-- leaving it out of the daily rollover's missing-Dailies count, since lab games have no scheduled Dailies.
-- Rollback: delete from public.games where id = 'emojihits';
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort) values
  ('emojihits', 'clue', 'Emoji Hits', 'coming_soon', 'M3+', 'custom', 'score', false, 4000, 56)
on conflict (id) do nothing;
