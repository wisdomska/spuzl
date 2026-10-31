begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.match_rounds'::regclass), 'match_rounds has RLS enabled and forced');
select ok(not has_table_privilege('authenticated', 'public.match_rounds', 'insert'), 'clients cannot write match_rounds');
select ok(not has_function_privilege('authenticated', 'public.svc_match_finish(uuid, smallint, uuid, integer)', 'execute'), 'clients cannot record finishes');
select ok(not has_function_privilege('authenticated', 'public.svc_bay_commit(uuid, integer, uuid, jsonb, jsonb, smallint, text, uuid, text, timestamptz, integer[])', 'execute'), 'clients cannot commit board moves');
select ok(has_function_privilege('service_role', 'public.svc_match_commit(uuid, text, smallint, text, smallint, timestamptz, uuid, text, smallint, jsonb, jsonb)', 'execute'), 'service role commits rounds');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'mpa@test'), ('00000000-0000-0000-0000-0000000000b1', 'mpb@test'), ('00000000-0000-0000-0000-0000000000c1', 'mpc@test');
insert into public.players (id, nickname, age_band) values
  ('00000000-0000-0000-0000-0000000000a1', 'mp_alice', '18+'), ('00000000-0000-0000-0000-0000000000b1', 'mp_bobby', '18+'), ('00000000-0000-0000-0000-0000000000c1', 'mp_carol', '18+');
insert into public.matches (id, kind, status, games, round_started_at) values
  ('00000000-0000-0000-0000-00000000aaaa', 'duel', 'playing', '{crownfall,crownfall,crownfall}', now() - interval '5 seconds');
insert into public.match_players (match_id, player_id, seat) values
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 0),
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000b1', 1);

-- Finishes are timed by the database clock, once per player
select ok((select accepted from public.svc_match_finish('00000000-0000-0000-0000-00000000aaaa', 1::smallint, '00000000-0000-0000-0000-0000000000a1', 0)), 'a finish is recorded');
select cmp_ok((select time_ms from public.match_rounds where player_id = '00000000-0000-0000-0000-0000000000a1'), '>=', 4900, 'finish time comes from the server clock');
select ok(not (select accepted from public.svc_match_finish('00000000-0000-0000-0000-00000000aaaa', 2::smallint, '00000000-0000-0000-0000-0000000000b1', 0)), 'a finish for the wrong round is refused');

-- A round decision applies once
select ok(public.svc_match_commit('00000000-0000-0000-0000-00000000aaaa', 'playing', 1::smallint, 'playing', 2::smallint, now() + interval '9 seconds', null, null, null,
  '[{"player_id":"00000000-0000-0000-0000-0000000000a1","rounds_won":1}]'::jsonb, '[]'::jsonb), 'the first commit applies');
select ok(not public.svc_match_commit('00000000-0000-0000-0000-00000000aaaa', 'playing', 1::smallint, 'playing', 2::smallint, now(), null, null, null, '[]'::jsonb, '[]'::jsonb), 'a second commit for the same round is ignored');

-- Members read their match and its channel; others can't
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select is((select count(*)::int from public.match_rounds), 1, 'a member reads the round results');
select ok(private.can_use_topic('match:00000000-0000-0000-0000-00000000aaaa'), 'a member may join the match channel');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';
select is((select count(*)::int from public.match_rounds), 0, 'a stranger reads nothing');
select ok(not private.can_use_topic('match:00000000-0000-0000-0000-00000000aaaa') and not private.can_use_topic('match:not-a-uuid'), 'a stranger may not join the channel');
reset role;

select * from finish();
rollback;
