begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Migrations 20261116000001 and 20261125000001 (Gauntlet) plus the seed: 28 live games, 33 retired, none in the lab.
select is((select count(*)::int from public.games where status = 'live'), 28, '28 live games');
select is((select count(*)::int from public.games where status = 'retired'), 33, '33 retired games');
select is((select count(*)::int from public.games where status = 'coming_soon'), 0, 'the lab is empty');
select set_eq(
  $$select id from public.games where id in ('trotro', 'emojihits', 'beattap') and status = 'live'$$,
  array['trotro', 'emojihits', 'beattap'],
  'Trotro Jam, Emoji Hits and Beat Tap are live'
);
select is((select count(*)::int from public.games where world_id = 'number' and status = 'live'), 0, 'Number Den has no live game');
select throws_ok(
  $$update public.games set status = 'gone' where id = 'crownfall'$$,
  '23514',
  null,
  'status still only takes the known values'
);
-- Retired rows stay readable, so old results keep their game name.
set local role anon;
select is((select count(*)::int from public.games where status = 'retired'), 33, 'retired rows stay readable');
reset role;

select * from finish();
rollback;
