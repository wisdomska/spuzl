-- R3-14: removes Azonto Steps (`azonto`, the R2-P5 part B lab game) completely. Its code, copy, art and tests are
-- gone from the app; this removes the games row and everything that points at it, and takes 'azonto' out of every
-- game setting that lists game ids ("features.labGames", "practice.disabled" and any other array of ids).
-- Production has had it switched off since it shipped, so only test rows (if any) are expected to go. Rows of every
-- other game are untouched; RLS, policies and grants do not change.
--
-- Order: rows that reference an Azonto puzzle, attempt or match go before those, then the puzzles, then the game.
--   matches (and, by cascade, their players, rounds, chat, party rounds and votes), matchmaking_queue, feed_events,
--   daily_five, daily_results, challenges (cascade: challenge_results), ghost_runs, attempts, dailies,
--   content_items (reports keep their row, content_item_id set null), player_levels, learned_games,
--   client_metrics, puzzles: deleted where game_id = 'azonto'.
--   players.playing_game = 'azonto': set to null (the player stays; only the "playing now" note goes).
--   game_settings: 'azonto' removed from array values.
--   games: the 'azonto' row deleted.
--
-- Rollback: re-run the insert in 20261205005301_lab_azonto.sql (the games row, Arcade, coming_soon) and put
--   'azonto' back in "features.labGames" from the admin Settings page if it was there; deleted test rows are not
--   restored. Then delete from supabase_migrations.schema_migrations where version = '20261207001401'.

delete from public.matches where game_id = 'azonto';
delete from public.match_rounds where game_id = 'azonto';
delete from public.matchmaking_queue where game_id = 'azonto';
delete from public.feed_events where game_id = 'azonto';
delete from public.daily_five where game_id = 'azonto';
delete from public.daily_results where game_id = 'azonto';
delete from public.challenges where game_id = 'azonto';
delete from public.ghost_runs where game_id = 'azonto';
delete from public.attempts where game_id = 'azonto';
delete from public.dailies where game_id = 'azonto';
delete from public.content_items where game_id = 'azonto';
delete from public.player_levels where game_id = 'azonto';
delete from public.learned_games where game_id = 'azonto';
delete from public.client_metrics where game_id = 'azonto';
delete from public.puzzles where game_id = 'azonto';

update public.players set playing_game = null where playing_game = 'azonto';

update public.game_settings
set value = (
  select coalesce(jsonb_agg(e order by n), '[]'::jsonb)
  from jsonb_array_elements(value) with ordinality as t(e, n)
  where e <> to_jsonb('azonto'::text)
), updated_at = now()
where jsonb_typeof(value) = 'array' and value @> to_jsonb(array['azonto']);

delete from public.games where id = 'azonto';
