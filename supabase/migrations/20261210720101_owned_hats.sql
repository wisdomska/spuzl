-- R4-H (owner decision H, 10 Nov 2026: "the hats/shades should only show everywhere to players who have purchased
-- them"): a player's hat reaches other players only when they own it. players.hat is what they last equipped; every
-- payload now reads it through an inventory join, so a hat that was never bought, was refunded or was taken away by
-- an admin never comes back from the database.
--   private.owned_hat(player, hat): the hat when the player's inventory holds a Shop hat with that id
--     (cosmetics.payload->>'hat', else the cosmetic id), else null. Uses the inventory primary key.
--   public.owned_hat(players): the same as a PostgREST computed field, so server reads select `hat:owned_hat`
--     (players rows and embedded players(...)). Service role only.
--   public.player_cards: hat goes through the same check (same columns and grants).
--   private.leaderboard (svc_leaderboard): hat goes through the same check (latest body from 20261206000201,
--     only the hat column changed).
-- No table, row or grant widens; RLS untouched.
--
-- Rollback: re-run public.player_cards and private.leaderboard from 20261206000201_remove_schools.sql, then
--   drop function if exists public.owned_hat(public.players);
--   drop function if exists private.owned_hat(uuid, text);
--   delete from supabase_migrations.schema_migrations where version = '20261210720101';

create or replace function private.owned_hat(p_player uuid, p_hat text) returns text
language sql stable security definer set search_path = '' as $$
  select p_hat
  where p_hat is not null
    and exists (
      select 1
      from public.inventory i
      join public.cosmetics c on c.id = i.cosmetic_id
      where i.player_id = p_player and c.type = 'hat' and coalesce(c.payload ->> 'hat', c.id) = p_hat
    )
$$;
revoke execute on function private.owned_hat(uuid, text) from public, anon, authenticated;

create or replace function public.owned_hat(p public.players) returns text
language sql stable security definer set search_path = '' as $$ select private.owned_hat(p.id, p.hat) $$;
revoke execute on function public.owned_hat(public.players) from public, anon, authenticated;
grant execute on function public.owned_hat(public.players) to service_role;

-- The view runs as its owner (security_invoker = false), so the inventory join is inlined: viewers never need
-- execute on a private function, and they still see only a hat the player owns.
create or replace view public.player_cards with (security_invoker = false) as
  select p.id, p.nickname::text as nickname, p.avatar_color, p.skin,
         case
           when p.hat is not null and exists (
             select 1
             from public.inventory i
             join public.cosmetics c on c.id = i.cosmetic_id
             where i.player_id = p.id and c.type = 'hat' and coalesce(c.payload ->> 'hat', c.id) = p.hat
           ) then p.hat
         end as hat,
         p.title, p.level,
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
  select rk.rk, e.id, e.nickname::text, e.avatar_color, e.skin, private.owned_hat(e.id, e.hat), e.title, e.level, e.age_band,
         rk.val, rk.t, rk.h, rk.c, rk.n, e.id = p_viewer
  from ranked rk join eligible e on e.id = rk.pid
  where rk.rk <= p_limit or e.id = p_viewer
  order by rk.rk, e.nickname;
end $$;

revoke execute on function private.leaderboard(uuid, text, date, text, integer) from public, anon, authenticated;
