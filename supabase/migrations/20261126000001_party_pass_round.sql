-- Party Race: a player may sit out a round ("Skip this round"). match_players.passed_round holds the round they
-- passed; the round stops waiting for them and they score 0 for it, last on its podium. They play the next round.
-- Written only by the server (service role), like the rest of match_players.
--
-- Rollback:
--   alter table public.match_players drop column if exists passed_round;
--   delete from supabase_migrations.schema_migrations where version = '20261126000001';

alter table public.match_players add column if not exists passed_round smallint;
