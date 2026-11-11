begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Migrations 20261116000001, 20261125000001 (Gauntlet), 20261201001401 (Quads back) and 20261203005101 (eleven back
-- as lab games, R2-P5), 20261205005201 (Two Truths, a new lab game) and 20261207001401 (the R2-P5 part B dance game
-- removed, R3-14) and 20261211300101 (the twelve lab games graduated) plus the seed: 41 live games, 21 retired, none
-- in the lab (tests/230_graduate_lab_games.test.sql checks the graduation itself).
select is((select count(*)::int from public.games where status = 'live'), 41, '41 live games');
select is((select count(*)::int from public.games where status = 'retired'), 21, '21 retired games');
select is((select count(*)::int from public.games where status = 'coming_soon'), 0, 'no lab games left (all twelve graduated)');
select is(
  (select count(*)::int from public.games where status = 'live' and world_id not in ('logic', 'word', 'reflex', 'board')),
  0,
  'every live game sits in a live group'
);
select set_eq(
  $$select id from public.games where id in ('trotro', 'emojihits', 'beattap') and status = 'live'$$,
  array['trotro', 'emojihits', 'beattap'],
  'Trotro Jam, Emoji Hits and Beat Tap are live'
);
select is((select count(*)::int from public.games where world_id = 'number' and status = 'live'), 0, 'Number Den has no live game');
select is((select status from public.games where id = 'quads'), 'live', 'Quads is live again (R2-14)');
select throws_ok(
  $$update public.games set status = 'gone' where id = 'crownfall'$$,
  '23514',
  null,
  'status still only takes the known values'
);
-- Retired rows stay readable, so old results keep their game name.
set local role anon;
select is((select count(*)::int from public.games where status = 'retired'), 21, 'retired rows stay readable');
select is((select count(*)::int from public.games where status = 'live'), 41, 'live rows stay readable');
reset role;

select * from finish();
rollback;
