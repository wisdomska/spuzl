begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Migrations 20261116000001, 20261125000001 (Gauntlet), 20261201001401 (Quads back) and 20261203005101 (eleven back
-- as lab games, R2-P5) plus the seed: 29 live games, 21 retired, 11 in the lab.
select is((select count(*)::int from public.games where status = 'live'), 29, '29 live games');
select is((select count(*)::int from public.games where status = 'retired'), 21, '21 retired games');
select is((select count(*)::int from public.games where status = 'coming_soon'), 11, '11 lab games');
select set_eq(
  $$select id from public.games where status = 'coming_soon'$$,
  array['five', 'hilo', 'penalty', 'market', 'lightup', 'killer', 'dara', 'pinned', 'flagged', 'tripwire', 'pixl'],
  'the eleven games brought back are the lab games (R2-P5)'
);
select is(
  (select count(*)::int from public.games where status = 'coming_soon' and world_id not in ('logic', 'word', 'reflex', 'board')),
  0,
  'every lab game sits in a live group'
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
select is((select count(*)::int from public.games where status = 'coming_soon'), 11, 'lab rows stay readable');
reset role;

select * from finish();
rollback;
