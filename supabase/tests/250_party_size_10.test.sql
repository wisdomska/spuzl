begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.matches'::regclass and conname = 'matches_max_players_check'),
  'CHECK (((max_players >= 2) AND (max_players <= 10)))',
  'a Party room holds 2 to 10 players'
);
select ok(
  (select pg_get_constraintdef(oid) not like '%<= 8%' from pg_constraint
    where conrelid = 'public.matches'::regclass and conname = 'matches_max_players_check'),
  'the old cap of 8 is gone'
);
select col_default_is('public', 'matches', 'max_players', '8', 'new rooms still default to 8');

select * from finish();
rollback;
