begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Migration 20261211300101 plus the seed: the twelve lab games graduated, so 41 live games, 21 retired, none in the lab.
select is((select count(*)::int from public.games where status = 'live'), 41, '41 live games');
select is((select count(*)::int from public.games where status = 'coming_soon'), 0, 'no game is in the lab');
select is((select count(*)::int from public.games where status = 'retired'), 21, 'the 21 retired games stay retired');
select set_eq(
  $$select id from public.games
    where status = 'live'
      and id in ('five', 'hilo', 'penalty', 'market', 'lightup', 'killer', 'dara', 'pinned', 'flagged', 'tripwire', 'pixl',
                 'twotruths')$$,
  array['five', 'hilo', 'penalty', 'market', 'lightup', 'killer', 'dara', 'pinned', 'flagged', 'tripwire', 'pixl', 'twotruths'],
  'the twelve are live'
);
select results_eq(
  $$select id, world_id from public.games
    where id in ('five', 'hilo', 'penalty', 'market', 'lightup', 'killer', 'dara', 'pinned', 'flagged', 'tripwire', 'pixl',
                 'twotruths')
    order by id$$,
  $$values ('dara', 'board'), ('five', 'word'), ('flagged', 'word'), ('hilo', 'logic'), ('killer', 'logic'),
    ('lightup', 'logic'), ('market', 'logic'), ('penalty', 'reflex'), ('pinned', 'word'), ('pixl', 'logic'),
    ('tripwire', 'logic'), ('twotruths', 'word')$$,
  'their worlds stay: Words & Quiz, Puzzles, Arcade and Board Games'
);
select results_eq(
  $$select w.id, count(g.id)::int from public.worlds w join public.games g on g.world_id = w.id and g.status = 'live'
    group by w.id, w.sort order by w.sort$$,
  $$values ('logic', 15), ('word', 13), ('reflex', 7), ('board', 6)$$,
  'live games per group, in Home map order'
);
-- Catalogue order: every live game sorts before every retired one, and each graduated game sits in its world's place.
select ok(
  (select max(sort) from public.games where status = 'live') < (select min(sort) from public.games where status = 'retired'),
  'live games sort before retired ones'
);
select results_eq(
  $$select id from public.games where world_id = 'board' and status = 'live' order by sort$$,
  $$values ('chess'), ('draughts'), ('oware'), ('ludo'), ('fourup'), ('dara')$$,
  'Dara follows Four Up in Board Games'
);
-- Players read the rows as before.
set local role anon;
select is((select count(*)::int from public.games where status = 'live'), 41, 'players read the 41 live rows');
reset role;

select * from finish();
rollback;
