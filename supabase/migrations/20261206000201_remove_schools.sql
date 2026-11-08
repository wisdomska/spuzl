-- Removes schools and campuses everywhere: the School Cup (class challenges with a teacher's code), the school on
-- profiles and public player cards, the School leaderboard scope, the "Top of the Class" badge and the admin Schools
-- page. Production and preview held no school, class, member or badge rows when this ran, so no player data is lost.
--   public.svc_school_cup_board, private.school_cup_board: dropped.
--   public.player_cards: recreated without its school column (same columns otherwise, same grants).
--   private.leaderboard: redefined without the 'school' scope (latest body from 20261102000001, school lines removed).
--   public.school_cup_members, public.school_cups, public.schools (with their policies and indexes): dropped.
--   public.players.school_id and players_school_idx: dropped.
--   badge 'social-school' (and any player_badges rows), feature flag 'school_cup': deleted.
-- RLS stays forced on every remaining table; no grants widen.
--
-- Rollback: re-run the schools, school_cups and school_cup_members tables, the players.school_id column and index,
--   their policies (20261030000001_core.sql, 20261030000002_meta.sql, 20261030000003_rls.sql,
--   20261102000001_social_meta.sql), the player_cards view (20261031000001_test_accounts.sql), private.leaderboard
--   and the School Cup functions (20261102000001_social_meta.sql) and the badge and flag rows (supabase/seed.sql at
--   1.38.1), then delete from supabase_migrations.schema_migrations where version = '20261206000201'.

drop function if exists public.svc_school_cup_board(uuid);
drop function if exists private.school_cup_board(uuid);

drop view if exists public.player_cards;
create view public.player_cards with (security_invoker = false) as
  select p.id, p.nickname::text as nickname, p.avatar_color, p.skin, p.hat, p.title, p.level,
         case when p.age_band = '13-15' then null else p.country end as country,
         case when p.age_band = '13-15' then null else p.city end as city
  from public.players p
  where p.banned_at is null and not p.is_test;
revoke insert, update, delete, truncate on public.player_cards from anon, authenticated;
grant select on public.player_cards to anon, authenticated;

create or replace function private.leaderboard(p_viewer uuid, p_game text, p_date date, p_scope text, p_limit integer default 50)
returns table (pos integer, player_id uuid, nickname text, avatar_color text, skin text, hat text, title text, level integer,
               age_band text, value integer, time_ms integer, hints integer, clears integer, total integer, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v public.players; v_crew uuid; scoring text;
begin
  select * into v from public.players where id = p_viewer;
  select crew_id into v_crew from public.crew_members where crew_members.player_id = p_viewer;
  if p_game is not null then select g.scoring into scoring from public.games g where g.id = p_game; end if;
  return query
  with eligible as (
    select p.* from public.players p
    where p.banned_at is null and not p.ranking_revoked and not p.is_test
      and not exists (select 1 from public.blocks b where (b.player_id = p_viewer and b.blocked_id = p.id) or (b.player_id = p.id and b.blocked_id = p_viewer))
      and case p_scope
        when 'global' then true
        when 'friends' then p.id = p_viewer or p.id in (select private.friend_ids(p_viewer))
        when 'crew' then v_crew is not null and p.id in (select cm.player_id from public.crew_members cm where cm.crew_id = v_crew)
        when 'city' then v.city is not null and p.city = v.city and p.country = v.country and (p.age_band <> '13-15' or p.id = p_viewer)
        when 'country' then v.country is not null and p.country = v.country
        else false end
  ),
  results as (
    select r.* from public.daily_results r
    join eligible e on e.id = r.player_id
    where r.date = p_date and (p_game is null or r.game_id = p_game)
      and not exists (select 1 from public.attempts a where a.player_id = r.player_id and a.game_id = r.game_id
                      and a.daily_date = r.date and a.mode = 'daily' and a.status = 'flagged')
  ),
  per_player as (
    select r.player_id as pid,
      case when p_game is null then sum(r.time_ms)::int when scoring = 'score' then max(coalesce(r.score, 0)) else min(r.time_ms) end as val,
      sum(r.time_ms)::int as t, sum(r.hints)::int as h, sum(r.mistakes)::int as m, count(*)::int as c, max(r.finished_at) as fin
    from results r group by r.player_id
  ),
  ranked as (
    select pp.*, (rank() over (order by
        case when p_game is null then -pp.c else 0 end,
        case when scoring = 'score' then -pp.val else 0 end,
        pp.t, pp.h, pp.m, pp.fin))::int as rk,
      (count(*) over ())::int as n
    from per_player pp
  )
  select rk.rk, e.id, e.nickname::text, e.avatar_color, e.skin, e.hat, e.title, e.level, e.age_band,
         rk.val, rk.t, rk.h, rk.c, rk.n, e.id = p_viewer
  from ranked rk join eligible e on e.id = rk.pid
  where rk.rk <= p_limit or e.id = p_viewer
  order by rk.rk, e.nickname;
end $$;

revoke execute on function private.leaderboard(uuid, text, date, text, integer) from public, anon, authenticated;

drop table if exists public.school_cup_members;
drop table if exists public.school_cups;
drop index if exists public.players_school_idx;
alter table public.players drop column if exists school_id;
drop table if exists public.schools;

delete from public.player_badges where badge_id = 'social-school';
delete from public.badges where id = 'social-school';
delete from public.feature_flags where key = 'school_cup';
