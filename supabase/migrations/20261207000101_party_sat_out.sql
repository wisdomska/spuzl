-- R3-01: Party "Start without them". When the host starts with only the ready players, the players not ready yet sit
-- the set out: the server sets spectator = true and sat_out = true on their match_players row, so they watch and can't
-- play or score. Run it back clears both (only rows with sat_out, so a classroom host stays a spectator).
-- Written only by the server (service role), like the rest of match_players. RLS unchanged (still forced).
--
-- Rollback:
--   update public.match_players set spectator = false where sat_out;
--   alter table public.match_players drop column if exists sat_out;
--   delete from supabase_migrations.schema_migrations where version = '20261207000101';

alter table public.match_players add column if not exists sat_out boolean not null default false;
