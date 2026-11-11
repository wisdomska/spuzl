begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Migration 20261212010101: games.status takes On ('live'), In testing ('testing') and Off ('off'); games.versus.
select has_column('public', 'games', 'versus', 'games.versus exists');
select col_not_null('public', 'games', 'versus', 'games.versus is never null');
select col_default_is('public', 'games', 'versus', 'true', 'every game can be played in Duels and Parties by default');
select is((select count(*)::int from public.games where versus), (select count(*)::int from public.games), 'no game is kept out yet');

-- The three states (and the older values) are accepted; anything else is refused.
update public.games set status = 'testing' where id = 'pinned';
select is((select status from public.games where id = 'pinned'), 'testing', 'a game can be put In testing');
update public.games set status = 'off' where id = 'pinned';
select is((select status from public.games where id = 'pinned'), 'off', 'a game can be switched Off');
update public.games set status = 'live' where id = 'pinned';
select is((select status from public.games where id = 'pinned'), 'live', 'and back On');
select throws_ok(
  $$update public.games set status = 'paused' where id = 'pinned'$$,
  '23514',
  null,
  'an unknown status is refused'
);
select lives_ok($$update public.games set status = 'retired' where id = 'blackout'$$, 'retired stays a status');

-- The old lab status is gone from the data, and so is the old lab switch.
select is((select count(*)::int from public.games where status = 'coming_soon'), 0, 'no row is left in the old lab status');
select is((select count(*)::int from public.game_settings where key = 'features.labGames'), 0, 'the old lab switch row is gone');

-- Clients still only read the rows (Off and In testing rows stay readable for old results), and never write them.
update public.games set status = 'off', versus = false where id = 'flagged';
set local role anon;
select is((select status from public.games where id = 'flagged'), 'off', 'players read an Off row (names for old results)');
select throws_ok(
  $$update public.games set status = 'live' where id = 'flagged'$$,
  '42501',
  null,
  'players cannot change a state'
);
reset role;
set local role authenticated;
select throws_ok(
  $$update public.games set versus = true where id = 'flagged'$$,
  '42501',
  null,
  'signed-in players cannot change the Duels and Parties switch'
);
reset role;

select * from finish();
rollback;
