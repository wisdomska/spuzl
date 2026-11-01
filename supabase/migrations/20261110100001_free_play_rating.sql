-- World ranks from free play (Dailies off follow-up). Free-play boards are unique per player, so there is no shared
-- field for the day. private.free_percentile(game, difficulty, time, attempt) scores a free-play clear against the
-- last 30 days of verified, non-relaxed free-play clears of the same game and difficulty (other attempts only).
-- It returns null when fewer than 10 such clears exist; the server then treats the clear as an average result.
-- The server applies the Glicko-2 update with a smaller weight than a Daily (lib/rating/glicko2.ts FREE_PLAY_WEIGHT).
-- No new tables, so no RLS changes.
-- Rollback:
--   drop function if exists public.svc_free_percentile(text, text, integer, uuid);
--   drop function if exists private.free_percentile(text, text, integer, uuid);
--   drop index if exists public.attempts_free_board_idx;

create index if not exists attempts_free_board_idx on public.attempts (game_id, finished_at)
  where mode = 'free' and status = 'cleared';

create or replace function private.free_percentile(p_game text, p_difficulty text, p_time integer, p_attempt uuid)
returns numeric
language sql stable security definer set search_path = '' as $$
  with field as (
    select a.time_ms from public.attempts a
    where a.game_id = p_game and a.mode = 'free' and a.status = 'cleared'
      and a.finished_at >= now() - interval '30 days'
      and a.id <> p_attempt and a.relaxed = false and a.time_ms is not null
      and a.free_seed like '%|' || p_difficulty
  )
  select case when count(*) < 10 then null
              else round(100.0 * count(*) filter (where time_ms > p_time) / count(*), 0) end
  from field
$$;

create or replace function public.svc_free_percentile(p_game text, p_difficulty text, p_time integer, p_attempt uuid)
returns numeric
language sql stable security definer set search_path = '' as $$
  select private.free_percentile(p_game, p_difficulty, p_time, p_attempt)
$$;

revoke execute on function private.free_percentile(text, text, integer, uuid) from public, anon, authenticated;
revoke execute on function public.svc_free_percentile(text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.svc_free_percentile(text, text, integer, uuid) to service_role;
