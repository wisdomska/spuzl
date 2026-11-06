-- Board Bay "Play live" for 3 or 4 players (Ludo): how many seats the player is searching for. Only searches for the
-- same number are grouped; svc_bay_mm_claim_timed already claims any number of players at once.
--
-- Rollback:
--   alter table public.board_queue drop column if exists seats;
--   delete from supabase_migrations.schema_migrations where version = '20261130000002';
alter table public.board_queue add column if not exists seats smallint not null default 2 check (seats between 2 and 4);
