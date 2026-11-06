begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Migration 20261130100501 (R2-05): the Daily Five schedule is server-only, locked days hold, metrics accept its events.
select has_table('public', 'daily_five', 'daily five table');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.daily_five'::regclass), 'daily_five has RLS enabled and forced');
select has_column('public', 'attempts', 'daily_five', 'attempts are marked as Daily Five games');
select col_default_is('public', 'attempts', 'daily_five', 'false', 'existing attempts are not Daily Five games');
set local role authenticated;
select throws_ok($$select count(*) from public.daily_five$$, '42501', null, 'players cannot read the schedule directly');
reset role;

-- A locked day keeps its games: updates to the game or puzzle and deletes are refused until it is unlocked.
insert into public.puzzles (id, game_id, seed, difficulty, data, solution, solution_hash)
values ('00000000-0000-0000-0000-00000000d501', 'crownfall', 'five:test', 'easy', '{}', '[]', 'x');
insert into public.daily_five (date, slot, kind, world, game_id, puzzle_id, locked)
values ('2030-01-01', 1, 'world', 'logic', 'crownfall', '00000000-0000-0000-0000-00000000d501', true);
select throws_ok($$update public.daily_five set game_id = 'dusk' where date = '2030-01-01' and slot = 1$$, 'P0001', null, 'a locked day keeps its game');
select throws_ok($$delete from public.daily_five where date = '2030-01-01'$$, 'P0001', null, 'a locked day is never deleted');
update public.daily_five set locked = false where date = '2030-01-01';
select lives_ok($$delete from public.daily_five where date = '2030-01-01'$$, 'an unlocked day can be re-picked');

select lives_ok($$insert into public.client_metrics (name) values ('daily5_start'), ('daily5_complete'), ('daily5_share')$$, 'metrics accept the Daily Five events');

select * from finish();
rollback;
