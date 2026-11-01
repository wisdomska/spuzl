begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- SPZ-21: new players join friends first, otherwise a level-matched group in their tier; rollover splits evenly.
-- n = new player, r = returning player (was in a league before), f = friend of both (in a Gold group this week),
-- 31 more active players for the rollover.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a0', 'n@grouping.test'),
  ('00000000-0000-0000-0000-0000000008a1', 'r@grouping.test'),
  ('00000000-0000-0000-0000-0000000008a2', 'f@grouping.test');
insert into public.players (id, nickname, age_band, level) values
  ('00000000-0000-0000-0000-0000000008a0', 'grp_new', '18+', 2),
  ('00000000-0000-0000-0000-0000000008a1', 'grp_back', '18+', 4),
  ('00000000-0000-0000-0000-0000000008a2', 'grp_friend', '18+', 20);
insert into public.friendships (player_id, friend_id, status) values
  ('00000000-0000-0000-0000-0000000008a0', '00000000-0000-0000-0000-0000000008a2', 'accepted'),
  ('00000000-0000-0000-0000-0000000008a1', '00000000-0000-0000-0000-0000000008a2', 'accepted');
insert into public.leagues (id, tier, week_start) values
  ('22222222-2222-2222-2222-222222222201', 2, date_trunc('week', (now() at time zone 'utc'))::date),
  ('22222222-2222-2222-2222-222222222202', 0, date_trunc('week', (now() at time zone 'utc'))::date - 70);
insert into public.league_members (league_id, player_id) values
  ('22222222-2222-2222-2222-222222222201', '00000000-0000-0000-0000-0000000008a2'),
  ('22222222-2222-2222-2222-222222222202', '00000000-0000-0000-0000-0000000008a1');
insert into public.daily_results (date, game_id, player_id, time_ms, finished_at)
  select (now() at time zone 'utc')::date, 'crownfall', id, 60000, now()
  from unnest(array['00000000-0000-0000-0000-0000000008a0', '00000000-0000-0000-0000-0000000008a1']::uuid[]) id;

-- Candidates
select is((public.svc_league_candidates('00000000-0000-0000-0000-0000000008a0') -> 'candidates' -> 0 ->> 'friends')::int, 1,
  'a new player sees their friend''s group, at any tier, with the friend count');
select is((public.svc_league_candidates('00000000-0000-0000-0000-0000000008a0') ->> 'isNew')::boolean, true, 'a first-time player is new');
select is(jsonb_array_length(public.svc_league_candidates('00000000-0000-0000-0000-0000000008a1') -> 'candidates'), 0,
  'a returning player only sees groups at their own tier');

-- Join
select is(public.svc_join_current_league('00000000-0000-0000-0000-0000000008a0', '22222222-2222-2222-2222-222222222201'),
  '22222222-2222-2222-2222-222222222201'::uuid, 'a new player joins the friend''s group');
select isnt(public.svc_join_current_league('00000000-0000-0000-0000-0000000008a1', '22222222-2222-2222-2222-222222222201'),
  '22222222-2222-2222-2222-222222222201'::uuid, 'a returning player cannot jump into another tier through a friend');
select is((public.svc_league_candidates('00000000-0000-0000-0000-0000000008a0') ->> 'eligible')::boolean, false,
  'no candidates once placed');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000008a0", "role": "authenticated"}';
select throws_ok($$ select public.svc_league_candidates('00000000-0000-0000-0000-0000000008a0') $$, '42501', null,
  'clients cannot call the candidates function');
reset role;

-- Rollover: 31 extra active Bronze players never leave anyone alone.
insert into auth.users (id, email) select ('00000000-0000-0000-0000-000000000' || (900 + i))::uuid, 'roll' || i || '@grouping.test' from generate_series(1, 31) i;
insert into public.players (id, nickname, age_band) select ('00000000-0000-0000-0000-000000000' || (900 + i))::uuid, 'grp_roll' || i, '18+' from generate_series(1, 31) i;
insert into public.attempts (player_id, game_id, mode) select ('00000000-0000-0000-0000-000000000' || (900 + i))::uuid, 'crownfall', 'free' from generate_series(1, 31) i;
select public.svc_league_rollover('2030-01-07');
select ok((select max(n) - min(n) <= 1 from (
    select count(*) as n from public.leagues l join public.league_members m on m.league_id = l.id
    join public.players p on p.id = m.player_id where l.week_start = '2030-01-07' and l.tier = 0 and not p.is_test group by l.id) s),
  'rollover groups in a tier differ in size by at most one');
select ok((select min(n) from (select count(*) as n from public.leagues l join public.league_members m on m.league_id = l.id
    where l.week_start = '2030-01-07' and l.tier = 0 group by l.id) s) >= 15, 'no rollover group is left with a straggler');

select * from finish();
rollback;
