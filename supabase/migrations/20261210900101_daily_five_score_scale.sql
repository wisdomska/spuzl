-- Round 4, owner decision S: a per-game score scale for the Daily Five.
--
-- games.typical_score  a score game's typical score on the Daily Five's difficulty (Quickfire, Echo, Beat Tap and the
--                      other games scored on points). Daily Five points for those games come from the player's score
--                      against it (half the bonus at it, the full bonus at twice it; lib/daily-five fivePoints) instead
--                      of from time. NULL means "use the default in lib/games-meta TYPICAL_SCORE" (a score game with
--                      no default is scored on time), so existing rows need no backfill. Whole number, 1 to 1,000,000.
--                      Written only through the admin Library page (service role, audited as game_meta.update); read
--                      on the server and publicly through GET /api/v1/games/meta like typical_sec. Not a secret.
--
-- No other change: RLS on public.games is unchanged (read policy only, no client writes).
--
-- Rollback:
--   alter table public.games drop column if exists typical_score;
--   delete from supabase_migrations.schema_migrations where version = '20261210900101';
alter table public.games
  add column if not exists typical_score integer check (typical_score is null or typical_score between 1 and 1000000);
comment on column public.games.typical_score is
  'Daily Five typical score for a score game (half the points bonus at it, full at twice it); NULL = code default';
