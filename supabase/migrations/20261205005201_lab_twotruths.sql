-- R2-P5 part B: Two Truths and a Lie, a new all-ages lab game (games/twotruths). Players reach it only while the
-- admin setting "features.labGames" has its id; until then the app hides it and the server refuses it like an unknown
-- game. Its round bank lives in games/twotruths/content.ts; the admin Content page can draft new rounds
-- (content_items.game_id = 'twotruths', which needs this row for its foreign key).
--
-- Adds one games row (status coming_soon, as scripts/gen-seed.ts writes lab games). Nothing else changes.
--
-- Rollback (safe while the game is switched off: no attempts or content items reference it yet):
--   delete from public.content_items where game_id = 'twotruths';
--   delete from public.games where id = 'twotruths';
--   delete from supabase_migrations.schema_migrations where version = '20261205005201';

-- Fresh databases run migrations before the seed (worlds are empty then): insert only when the world exists;
-- supabase/seed.sql adds the row there.
insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
select * from (values
  ('twotruths', 'word', 'Two Truths and a Lie', 'coming_soon', 'M3+', 'custom', 'score', false, 8000, 61)
) as v(id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
where exists (select 1 from public.worlds w where w.id = v.world_id)
on conflict (id) do nothing;
