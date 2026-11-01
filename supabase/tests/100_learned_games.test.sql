begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Learned games (guided first play) belong to the account: forced RLS, players read only their own rows and
-- write none (the API writes with the service role).
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.learned_games'::regclass),
  'learned_games has forced RLS');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a01', 'a@learned.test'),
  ('00000000-0000-0000-0000-000000000a02', 'b@learned.test');
insert into public.players (id, nickname, age_band) values
  ('00000000-0000-0000-0000-000000000a01', 'learned_a', '18+'),
  ('00000000-0000-0000-0000-000000000a02', 'learned_b', '18+');
insert into public.learned_games (player_id, game_id) values
  ('00000000-0000-0000-0000-000000000a01', 'nine'),
  ('00000000-0000-0000-0000-000000000a01', 'dusk'),
  ('00000000-0000-0000-0000-000000000a02', 'five');

select lives_ok(
  $$ insert into public.learned_games (player_id, game_id) values ('00000000-0000-0000-0000-000000000a01', 'nine')
     on conflict do nothing $$,
  'learning a game twice is a no-op');
select throws_ok(
  $$ insert into public.learned_games (player_id, game_id) values ('00000000-0000-0000-0000-000000000a01', 'Not a game!') $$,
  '23514', null, 'game ids are checked');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000a01", "role": "authenticated"}';

select results_eq(
  $$ select game_id from public.learned_games order by game_id $$,
  $$ values ('dusk'::text), ('nine'::text) $$,
  'a player reads only their own learned games');
select throws_ok(
  $$ insert into public.learned_games (player_id, game_id) values ('00000000-0000-0000-0000-000000000a01', 'sixer') $$,
  '42501', null, 'players cannot add learned games directly');
select throws_ok(
  $$ delete from public.learned_games $$,
  '42501', null, 'players cannot delete learned games');

reset role;
set local role anon;
select throws_ok($$ select * from public.learned_games $$, '42501', null, 'anon cannot read learned games');

reset role;
select is((select count(*)::int from public.learned_games where player_id = '00000000-0000-0000-0000-000000000a01'), 2,
  'rows are intact');
delete from public.players where id = '00000000-0000-0000-0000-000000000a02';
select is((select count(*)::int from public.learned_games where player_id = '00000000-0000-0000-0000-000000000a02'), 0,
  'a deleted account takes its learned games with it');

select * from finish();
rollback;
