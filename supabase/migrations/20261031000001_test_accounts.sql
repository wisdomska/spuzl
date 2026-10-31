-- One Supabase project serves production and staging (free tier allows 2 active projects per account).
-- Players created on staging (VERCEL_ENV=preview) are test accounts and never touch public boards.

alter table public.players add column if not exists is_test boolean not null default false;
create index if not exists players_is_test_idx on public.players (id) where is_test;

create or replace view public.player_cards with (security_invoker = false) as
  select p.id, p.nickname::text as nickname, p.avatar_color, p.skin, p.hat, p.title, p.level,
         case when p.age_band = '13-15' then null else p.country end as country,
         case when p.age_band = '13-15' then null else p.city end as city,
         case when p.age_band = '13-15' then null when s.verified_by is null then null else s.name end as school
  from public.players p left join public.schools s on s.id = p.school_id
  where p.banned_at is null and not p.is_test;
revoke insert, update, delete, truncate on public.player_cards from anon, authenticated;
grant select on public.player_cards to anon, authenticated;

-- Test players' Daily results stay readable to themselves but never rank or count toward medians.
create or replace function private.rank_day(p_date date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  with ranked as (
    select r.date, r.game_id, r.player_id,
      rank() over (partition by r.game_id order by
        case when g.scoring = 'score' then -coalesce(r.score, 0) else 0 end,
        r.time_ms, r.hints, r.mistakes, r.finished_at) as rk,
      count(*) over (partition by r.game_id) as n
    from public.daily_results r
    join public.games g on g.id = r.game_id
    join public.players p on p.id = r.player_id and not p.is_test
    where r.date = p_date
  )
  update public.daily_results d set rank_global = ranked.rk,
    percentile = round(100.0 * (ranked.n - ranked.rk) / greatest(ranked.n - 1, 1), 2)
  from ranked where d.date = ranked.date and d.game_id = ranked.game_id and d.player_id = ranked.player_id;
end $$;

create or replace function private.daily_median(p_game text, p_date date) returns integer
language sql stable security definer set search_path = '' as $$
  select case when count(*) >= 5 then percentile_cont(0.5) within group (order by r.time_ms)::integer end
  from public.daily_results r join public.players p on p.id = r.player_id and not p.is_test
  where r.game_id = p_game and r.date = p_date
$$;

create or replace function private.daily_percentile(p_game text, p_date date, p_time integer) returns numeric
language sql stable security definer set search_path = '' as $$
  select case when count(*) <= 1 then 100 else round(100.0 * count(*) filter (where r.time_ms > p_time) / (count(*) - 1), 0) end
  from public.daily_results r join public.players p on p.id = r.player_id and not p.is_test
  where r.game_id = p_game and r.date = p_date
$$;

-- Public Daily boards hide test players.
-- The policy needs players.is_test, which clients cannot read, so it goes through a definer helper.
create or replace function private.is_test_player(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce((select is_test from public.players where id = p), false) $$;
drop policy if exists daily_results_read on public.daily_results;
create policy daily_results_read on public.daily_results for select to anon, authenticated
  using (player_id = (select auth.uid()) or not private.is_test_player(player_id));

revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to anon;
grant execute on function private.is_friend(uuid), private.in_match(uuid), private.in_league(uuid) to authenticated;
grant execute on function private.is_test_player(uuid) to anon, authenticated;

-- League placement groups test players separately, so staging can exercise leagues without mixing in.
create or replace function private.league_rollover(p_week date default date_trunc('week', (now() at time zone 'utc'))::date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare prev date := p_week - 7; groups integer := 0; rec record; members uuid[]; i integer;
begin
  with ranked as (
    select m.league_id, m.player_id, l.tier,
      row_number() over (partition by m.league_id order by m.points desc, m.player_id) as rk,
      count(*) over (partition by m.league_id) as n
    from public.league_members m join public.leagues l on l.id = m.league_id
    where l.week_start = prev and l.finalised_at is null
  )
  update public.league_members lm set final_rank = r.rk,
    result = case when r.rk <= 7 and r.tier < 4 then 'promoted' when r.rk > r.n - 5 and r.n > 12 and r.tier > 0 then 'demoted' else 'stayed' end
  from ranked r where lm.league_id = r.league_id and lm.player_id = r.player_id;
  update public.leagues set finalised_at = now() where week_start = prev and finalised_at is null;

  -- New week placement: everyone who played in the last 14 days.
  for rec in
    with next_tier as (
      select p.id as player_id, p.is_test,
        coalesce((select least(4, greatest(0, l.tier + case lm.result when 'promoted' then 1 when 'demoted' then -1 else 0 end))
                  from public.league_members lm join public.leagues l on l.id = lm.league_id
                  where lm.player_id = p.id and l.week_start = prev), 0) as tier,
        (select count(*) from public.attempts a where a.player_id = p.id and a.started_at > now() - interval '14 days') as activity
      from public.players p
      where p.banned_at is null and exists (select 1 from public.attempts a where a.player_id = p.id and a.started_at > now() - interval '14 days')
        and not exists (select 1 from public.league_members lm join public.leagues l on l.id = lm.league_id where lm.player_id = p.id and l.week_start = p_week)
    )
    select tier, is_test, array_agg(player_id order by activity desc, player_id) as ids from next_tier group by tier, is_test
  loop
    i := 1;
    while i <= coalesce(array_length(rec.ids, 1), 0) loop
      members := rec.ids[i : i + 29];
      with nl as (insert into public.leagues (tier, week_start) values (rec.tier, p_week) returning id)
      insert into public.league_members (league_id, player_id) select nl.id, unnest(members) from nl;
      groups := groups + 1;
      i := i + 30;
    end loop;
  end loop;
  insert into public.audit_log (action, detail) values ('cron.league_rollover', jsonb_build_object('week', p_week, 'groups', groups));
  return jsonb_build_object('week', p_week, 'groups', groups);
end $$;
revoke execute on function private.league_rollover(date) from public, anon, authenticated;
