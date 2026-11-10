begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Round 4, owner decision S (20261210900101): the Daily Five typical score per score game.
select has_column('public', 'games', 'typical_score', 'games.typical_score exists');
select col_type_is('public', 'games', 'typical_score', 'integer', 'a whole number');
select col_is_null('public', 'games', 'typical_score', 'NULL means the code default');

insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
select 'quickfire', w.id, 'Quickfire', 'live', 'M2', 'custom', 'score', false, 0, 20
from public.worlds w where w.id = 'word'
on conflict (id) do nothing;

select lives_ok($$update public.games set typical_score = 400 where id = 'quickfire'$$,
  'an admin override is stored');
select throws_ok($$update public.games set typical_score = 0 where id = 'quickfire'$$,
  '23514', null, 'zero is refused (the scale divides by it)');
select throws_ok($$update public.games set typical_score = 1000001 where id = 'quickfire'$$,
  '23514', null, 'more than a million is refused');

select * from finish();
rollback;
