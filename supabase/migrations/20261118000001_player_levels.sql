-- Level ladders ("Levels" mode beside free play; lib/game/levels.ts).
-- public.player_levels keeps every level a player has cleared, per game: the best time and when it was first
-- cleared. Rows are written only by the API with the service role, after the server has verified the clear
-- (svc_record_level_clear, which also refuses a level more than one past the player's highest clear); players
-- read their own rows. public.attempts.mode gains 'level' (its server seed stays in the hidden free_seed column).
-- Rollback:
--   drop function if exists public.svc_level_tops(uuid);
--   drop function if exists public.svc_record_level_clear(uuid, text, integer, integer);
--   drop table if exists public.player_levels;
--   delete from public.attempts where mode = 'level';
--   alter table public.attempts drop constraint if exists attempts_mode_check;
--   alter table public.attempts add constraint attempts_mode_check
--     check (mode in ('tutorial', 'daily', 'free', 'archive', 'duel', 'race', 'challenge'));
--   delete from supabase_migrations.schema_migrations where version = '20261118000001';

alter table public.attempts drop constraint if exists attempts_mode_check;
alter table public.attempts add constraint attempts_mode_check
  check (mode in ('tutorial', 'daily', 'free', 'archive', 'duel', 'race', 'challenge', 'level'));

create table if not exists public.player_levels (
  player_id uuid not null references public.players (id) on delete cascade,
  game_id text not null references public.games (id),
  level integer not null check (level between 1 and 9999),
  best_ms integer not null check (best_ms >= 0),
  cleared_at timestamptz not null default now(),
  primary key (player_id, game_id, level)
);

alter table public.player_levels enable row level security;
alter table public.player_levels force row level security;
revoke all on public.player_levels from anon, authenticated;
grant select on public.player_levels to authenticated;
drop policy if exists player_levels_own on public.player_levels;
create policy player_levels_own on public.player_levels for select to authenticated
  using (player_id = (select auth.uid()));

-- Records a verified level clear: keeps the best time and the first clear time. Levels unlock one at a time, so a
-- level more than one past the player's highest clear is refused here too (the API checks it at start).
create or replace function public.svc_record_level_clear(p_player uuid, p_game text, p_level integer, p_time integer)
returns table (top integer, best_ms integer)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare cur_top integer;
begin
  select coalesce(max(l.level), 0) into cur_top from public.player_levels l where l.player_id = p_player and l.game_id = p_game;
  if p_level < 1 or p_level > cur_top + 1 then
    raise exception 'level % is locked (highest clear %)', p_level, cur_top using errcode = '22023';
  end if;
  insert into public.player_levels as l (player_id, game_id, level, best_ms)
  values (p_player, p_game, p_level, greatest(0, p_time))
  on conflict (player_id, game_id, level) do update set best_ms = least(l.best_ms, excluded.best_ms);
  return query
    select greatest(cur_top, p_level), l.best_ms from public.player_levels l
    where l.player_id = p_player and l.game_id = p_game and l.level = p_level;
end $$;

-- Highest clear per game for one player (game cards).
create or replace function public.svc_level_tops(p_player uuid)
returns table (game_id text, top integer)
language sql stable security definer set search_path = '' as $$
  select l.game_id, max(l.level) from public.player_levels l where l.player_id = p_player group by l.game_id
$$;

revoke execute on function public.svc_record_level_clear(uuid, text, integer, integer), public.svc_level_tops(uuid)
  from public, anon, authenticated;
grant execute on function public.svc_record_level_clear(uuid, text, integer, integer), public.svc_level_tops(uuid)
  to service_role;
