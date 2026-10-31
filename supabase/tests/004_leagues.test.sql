begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- 30 players in one Silver league last week with points 1..30
insert into auth.users (id, email) select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'l' || i || '@test' from generate_series(1, 30) i;
insert into public.players (id, nickname, age_band) select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'league' || i, '18+' from generate_series(1, 30) i;
insert into public.leagues (id, tier, week_start) values ('11111111-1111-1111-1111-111111111111', 1, '2026-11-02');
insert into public.league_members (league_id, player_id, points)
  select '11111111-1111-1111-1111-111111111111', ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, i * 10 from generate_series(1, 30) i;
insert into public.attempts (player_id, game_id, mode) select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'crownfall', 'free' from generate_series(1, 30) i;

select public.svc_league_rollover('2026-11-09');
select is((select count(*)::int from public.league_members where league_id = '11111111-1111-1111-1111-111111111111' and result = 'promoted'), 7, 'top 7 promote');
select is((select count(*)::int from public.league_members where league_id = '11111111-1111-1111-1111-111111111111' and result = 'demoted'), 5, 'bottom 5 demote');
select is((select result from public.league_members where league_id = '11111111-1111-1111-1111-111111111111' and player_id = '00000000-0000-0000-0000-000000000030'), 'promoted', 'the top scorer is promoted');
select is((select l.tier::int from public.league_members m join public.leagues l on l.id = m.league_id
  where m.player_id = '00000000-0000-0000-0000-000000000030' and l.week_start = '2026-11-09'), 2, 'promoted players start the new week one tier up');
select is((select l.tier::int from public.league_members m join public.leagues l on l.id = m.league_id
  where m.player_id = '00000000-0000-0000-0000-000000000001' and l.week_start = '2026-11-09'), 0, 'demoted players drop one tier');
select * from finish();
rollback;
