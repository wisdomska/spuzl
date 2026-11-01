-- Free-play seed stays on the server (1.2.0 follow-up "Free-play seed"; free play now moves world ranks).
-- public.attempts.free_seed ('<seed>|<difficulty>') rebuilds a free-play board and its solution. The start
-- route no longer returns it, but players can read their own attempts through the Data API (policy
-- attempts_own), so the column itself is hidden: clients keep select on every other column of attempts, and
-- the server (service role) still reads and writes free_seed to verify the clear at finish.
-- A column added to public.attempts later is not readable by players until it is granted here too.
-- Rollback:
--   grant select on public.attempts to anon, authenticated;
--   delete from supabase_migrations.schema_migrations where version = '20261110300001';

revoke select on public.attempts from anon, authenticated;
grant select (
  id, player_id, game_id, mode, daily_date, puzzle_id, started_at, first_move_at, finished_at, time_ms, active_ms,
  hints, mistakes, deaths, score, state, moves, status, verified, flag_reason, relaxed, offline, ref_id
) on public.attempts to authenticated;
