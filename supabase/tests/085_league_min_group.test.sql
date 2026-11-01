begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- The weekly rollover merges tiers below leagues.minGroup into the nearest tier, keeping each player's home tier.
-- Last week (2031-02-24, already finalised): 3 players at tier 4, 12 at tier 2, 9 at tier 0, all active.
insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-0000000085' || lpad(i::text, 2, '0'))::uuid, 'mg' || i || '@min-group.test' from generate_series(1, 24) i;
insert into public.players (id, nickname, age_band)
  select ('00000000-0000-0000-0000-0000000085' || lpad(i::text, 2, '0'))::uuid, 'mg_' || i, '18+' from generate_series(1, 24) i;
insert into public.attempts (player_id, game_id, mode)
  select ('00000000-0000-0000-0000-0000000085' || lpad(i::text, 2, '0'))::uuid, 'crownfall', 'free' from generate_series(1, 24) i;
insert into public.leagues (id, tier, week_start, finalised_at) values
  ('85850000-0000-0000-0000-000000000004', 4, '2031-02-24', now()),
  ('85850000-0000-0000-0000-000000000002', 2, '2031-02-24', now()),
  ('85850000-0000-0000-0000-000000000000', 0, '2031-02-24', now());
insert into public.league_members (league_id, player_id, result)
  select case when i <= 3 then '85850000-0000-0000-0000-000000000004'::uuid
              when i <= 15 then '85850000-0000-0000-0000-000000000002'::uuid
              else '85850000-0000-0000-0000-000000000000'::uuid end,
    ('00000000-0000-0000-0000-0000000085' || lpad(i::text, 2, '0'))::uuid, 'stayed'
  from generate_series(1, 24) i;

create temp view mg_week as
  select l.id, l.tier, l.week_start, m.player_id, m.home_tier
  from public.leagues l join public.league_members m on m.league_id = l.id
  where m.player_id::text like '00000000-0000-0000-0000-0000000085%';

-- Week 1: minGroup is the default 8. Tier 4 (3 players) merges into tier 2, the nearest tier with players.
select is((public.svc_league_rollover('2031-03-03') ->> 'merged')::int, 1, 'one small tier is merged');
select is((select count(distinct id)::int from mg_week where week_start = '2031-03-03'), 2, 'two groups: tier 2 (merged) and tier 0');
select ok((select min(n) >= 8 from (select count(*) as n from mg_week where week_start = '2031-03-03' group by id) s),
  'no group is below minGroup');
select is((select array_agg(distinct tier) from mg_week where week_start = '2031-03-03'
           and player_id in ('00000000-0000-0000-0000-000000008501', '00000000-0000-0000-0000-000000008502')),
  array[2::smallint], 'the tier 4 players play in the tier 2 group');
select is((select array_agg(distinct home_tier) from mg_week where week_start = '2031-03-03' and player_id <= '00000000-0000-0000-0000-000000008503'),
  array[4::smallint], 'and keep home tier 4');
select ok((select bool_and(home_tier is null) from mg_week where week_start = '2031-03-03' and player_id > '00000000-0000-0000-0000-000000008503'),
  'players in their own tier have no home tier');
select is(private.next_league_tier('00000000-0000-0000-0000-000000008501', '2031-03-03'), 4::smallint,
  'next week''s tier starts from the home tier');

-- Week 2: the tier 4 players top the merged table. They cannot be promoted past the top tier, and they keep it.
update public.league_members m set points = case when m.player_id <= '00000000-0000-0000-0000-000000008503' then 1000 else 10 end
  from public.leagues l where l.id = m.league_id and l.week_start = '2031-03-03';
insert into public.game_settings (key, value) values ('leagues.minGroup', '2'::jsonb)
  on conflict (key) do update set value = excluded.value;
select is(private.league_min_group(), 2, 'minGroup comes from the game setting');
select is((public.svc_league_rollover('2031-03-10') ->> 'merged')::int, 0, 'with minGroup 2 nothing merges');
select is((select array_agg(distinct m.result) from public.league_members m join public.leagues l on l.id = m.league_id
           where l.week_start = '2031-03-03' and m.player_id <= '00000000-0000-0000-0000-000000008503'),
  array['stayed'::text], 'a home tier 4 player at the top of a merged group stays at tier 4');
select is((select count(*)::int from public.league_members m join public.leagues l on l.id = m.league_id
           where l.week_start = '2031-03-03' and l.tier = 2 and m.home_tier is null and m.result = 'promoted'), 4,
  'the tier 2 players right below them are promoted (ranks 4 to 7)');
select is((select tier from mg_week where week_start = '2031-03-10' and player_id = '00000000-0000-0000-0000-000000008501'), 4::smallint,
  'the next week they play in a tier 4 group again');
select is((select home_tier from mg_week where week_start = '2031-03-10' and player_id = '00000000-0000-0000-0000-000000008501'), null::smallint,
  'with no home tier');

-- Mid-week: a late joiner from a merged tier finds the merged group.
delete from public.game_settings where key = 'leagues.minGroup';
insert into public.leagues (id, tier, week_start) values
  ('85850000-0000-0000-0000-0000000000a2', 2, date_trunc('week', (now() at time zone 'utc'))::date),
  ('85850000-0000-0000-0000-0000000000b4', 4, date_trunc('week', (now() at time zone 'utc'))::date - 7);
insert into public.league_members (league_id, player_id, home_tier) values
  ('85850000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000008501', 4);
insert into public.league_members (league_id, player_id, result) values
  ('85850000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000008502', 'stayed');
insert into public.daily_results (date, game_id, player_id, time_ms, finished_at)
  values ((now() at time zone 'utc')::date, 'crownfall', '00000000-0000-0000-0000-000000008502', 60000, now());
select is((select (c ->> 'tier')::int from jsonb_array_elements(public.svc_league_candidates('00000000-0000-0000-0000-000000008502') -> 'candidates') c
           where c ->> 'id' = '85850000-0000-0000-0000-0000000000a2'), 4,
  'a merged group is a candidate at the joiner''s own tier');
select is(public.svc_join_current_league('00000000-0000-0000-0000-000000008502', null), '85850000-0000-0000-0000-0000000000a2'::uuid,
  'and the join falls back to it rather than opening a group of one');
select is(public.svc_league_candidates('00000000-0000-0000-0000-000000008502') -> 'league' ->> 'id', '85850000-0000-0000-0000-0000000000a2',
  'once placed, candidates return the player''s league so the API skips the join');

select * from finish();
rollback;
