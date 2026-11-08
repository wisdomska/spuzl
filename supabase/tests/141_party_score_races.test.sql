-- R3-08 (20261207000801): Party score races. Race logs are server-only, appended in order by svc_race_log while the
-- round is live; round rows keep the server's score.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_column('public', 'match_rounds', 'score', 'round rows carry a score');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.match_race_logs'::regclass), 'match_race_logs has RLS forced');
select ok(not has_table_privilege('authenticated', 'public.match_race_logs', 'select'), 'clients cannot read race logs');
select ok(not has_function_privilege('authenticated', 'public.svc_race_log(uuid, uuid, smallint, integer, jsonb)', 'execute'), 'clients cannot append to race logs');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000008a1', 'sra@test'), ('00000000-0000-0000-0000-0000000008b1', 'srb@test');
insert into public.players (id, nickname, age_band) values
  ('00000000-0000-0000-0000-0000000008a1', 'sr_alice', '18+'), ('00000000-0000-0000-0000-0000000008b1', 'sr_bobby', '13-15');
insert into public.matches (id, kind, status, games, round, round_started_at) values
  ('00000000-0000-0000-0000-00000000a801', 'race', 'playing', '{quickfire,quickfire,quickfire}', 1, now() - interval '5 seconds');
insert into public.match_players (match_id, player_id, seat, spectator) values
  ('00000000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-0000000008a1', 0, false),
  ('00000000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-0000000008b1', 1, true);

select ok(public.svc_race_log('00000000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-0000000008a1', 1::smallint, 0, '{"q":0,"open":true}'::jsonb), 'the first entry starts the log');
select ok(public.svc_race_log('00000000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-0000000008a1', 1::smallint, 1, '{"q":0,"pick":1,"ms":2000}'::jsonb), 'the next entry appends at the length read');
select ok(not public.svc_race_log('00000000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-0000000008a1', 1::smallint, 1, '{"q":0,"pick":2,"ms":2000}'::jsonb), 'a stale length (a second answer at once) changes nothing');
select ok(not public.svc_race_log('00000000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-0000000008a1', 2::smallint, 0, '{"q":0,"open":true}'::jsonb), 'not for a round that is not the current one');
select ok(not public.svc_race_log('00000000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-0000000008b1', 1::smallint, 0, '{"q":0,"open":true}'::jsonb), 'not for a spectator');

select ok(public.svc_match_commit('00000000-0000-0000-0000-00000000a801', 'playing', 1::smallint, 'round_end', 1::smallint, null, null, null, null, '[]'::jsonb,
  '[{"player_id":"00000000-0000-0000-0000-0000000008a1","game_id":"quickfire","time_ms":40000,"place":1,"points":600,"won":true,"score":930}]'::jsonb)
  and (select score from public.match_rounds where match_id = '00000000-0000-0000-0000-00000000a801' and player_id = '00000000-0000-0000-0000-0000000008a1') = 930,
  'a committed round keeps the server score');

select * from finish();
rollback;
