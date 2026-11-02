begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Level ladders: forced RLS, players read only their own rows and write none; the service function records a
-- verified clear (best time kept), and refuses a level more than one past the player's highest clear.
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.player_levels'::regclass),
  'player_levels has forced RLS');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000b01', 'a@levels.test'),
  ('00000000-0000-0000-0000-000000000b02', 'b@levels.test');
insert into public.players (id, nickname, age_band) values
  ('00000000-0000-0000-0000-000000000b01', 'levels_a', '18+'),
  ('00000000-0000-0000-0000-000000000b02', 'levels_b', '18+');

select results_eq(
  $$ select top, best_ms from public.svc_record_level_clear('00000000-0000-0000-0000-000000000b01', 'gotcha', 1, 9000) $$,
  $$ values (1, 9000) $$,
  'level 1 is open to everyone');
select results_eq(
  $$ select top, best_ms from public.svc_record_level_clear('00000000-0000-0000-0000-000000000b01', 'gotcha', 2, 12000) $$,
  $$ values (2, 12000) $$,
  'clearing level 1 opens level 2');
select throws_ok(
  $$ select * from public.svc_record_level_clear('00000000-0000-0000-0000-000000000b01', 'gotcha', 4, 5000) $$,
  '22023', null, 'a level two past the highest clear is locked');
select throws_ok(
  $$ select * from public.svc_record_level_clear('00000000-0000-0000-0000-000000000b01', 'gotcha', 0, 5000) $$,
  '22023', null, 'there is no level 0');
select results_eq(
  $$ select top, best_ms from public.svc_record_level_clear('00000000-0000-0000-0000-000000000b01', 'gotcha', 1, 7000) $$,
  $$ values (2, 7000) $$,
  'a faster replay keeps the better time and the highest clear');
select results_eq(
  $$ select top, best_ms from public.svc_record_level_clear('00000000-0000-0000-0000-000000000b01', 'gotcha', 1, 20000) $$,
  $$ values (2, 7000) $$,
  'a slower replay keeps the best time');
select lives_ok(
  $$ select * from public.svc_record_level_clear('00000000-0000-0000-0000-000000000b01', 'lost', 1, 30000) $$,
  'ladders are per game');
select lives_ok(
  $$ select * from public.svc_record_level_clear('00000000-0000-0000-0000-000000000b02', 'gotcha', 1, 15000) $$,
  'ladders are per player');
select results_eq(
  $$ select game_id, top from public.svc_level_tops('00000000-0000-0000-0000-000000000b01') order by game_id $$,
  $$ values ('gotcha'::text, 2), ('lost'::text, 1) $$,
  'tops are the highest clear per game');
select throws_ok(
  $$ insert into public.player_levels (player_id, game_id, level, best_ms) values ('00000000-0000-0000-0000-000000000b01', 'not-a-game', 1, 1) $$,
  '23503', null, 'game ids must exist');
select lives_ok(
  $$ insert into public.attempts (player_id, game_id, mode, free_seed) values ('00000000-0000-0000-0000-000000000b01', 'gotcha', 'level', 'level:gotcha:3|easy') $$,
  'attempts accept the level mode');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000b01", "role": "authenticated"}';

select results_eq(
  $$ select game_id, level, best_ms from public.player_levels order by game_id, level $$,
  $$ values ('gotcha'::text, 1, 7000), ('gotcha'::text, 2, 12000), ('lost'::text, 1, 30000) $$,
  'a player reads only their own levels');
select throws_ok(
  $$ insert into public.player_levels (player_id, game_id, level, best_ms) values ('00000000-0000-0000-0000-000000000b01', 'gotcha', 3, 1) $$,
  '42501', null, 'players cannot write levels directly');
select throws_ok(
  $$ select * from public.svc_record_level_clear('00000000-0000-0000-0000-000000000b01', 'gotcha', 3, 1) $$,
  '42501', null, 'players cannot call the record function');

reset role;
delete from public.players where id = '00000000-0000-0000-0000-000000000b02';
select is((select count(*)::int from public.player_levels where player_id = '00000000-0000-0000-0000-000000000b02'), 0,
  'a deleted account takes its levels with it');

select * from finish();
rollback;
