begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- R4-24 (20261210240101): members read the room's ink channel; no client may publish on it.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000024a1', 'inka@test'), ('00000000-0000-0000-0000-0000000024b1', 'inkb@test');
insert into public.players (id, nickname, age_band) values
  ('00000000-0000-0000-0000-0000000024a1', 'ink_alice', '18+'), ('00000000-0000-0000-0000-0000000024b1', 'ink_bobby', '18+');
insert into public.matches (id, kind, status, games) values
  ('00000000-0000-0000-0000-00000000240a', 'race', 'playing', '{crownfall}');
insert into public.match_players (match_id, player_id, seat) values
  ('00000000-0000-0000-0000-00000000240a', '00000000-0000-0000-0000-0000000024a1', 0);

select ok(not has_function_privilege('anon', 'private.can_send_topic(text)', 'execute'), 'anon cannot call can_send_topic');
select ok(has_function_privilege('authenticated', 'private.can_send_topic(text)', 'execute'), 'players can (the policy calls it)');
select ok((select with_check like '%can_send_topic%' from pg_policies where schemaname = 'realtime' and tablename = 'messages'
           and policyname = 'spuzl_realtime_write'), 'the write policy checks can_send_topic');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000024a1", "role": "authenticated"}';
select ok(private.can_use_topic('ink:00000000-0000-0000-0000-00000000240a'), 'a member may read the ink channel');
select ok(not private.can_send_topic('ink:00000000-0000-0000-0000-00000000240a'), 'a member may not publish on the ink channel');
select ok(private.can_send_topic('match:00000000-0000-0000-0000-00000000240a'), 'a member still publishes on the match channel');
select ok(private.can_send_topic('user:00000000-0000-0000-0000-0000000024a1'), 'and on their own user channel');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000024b1", "role": "authenticated"}';
select ok(not private.can_use_topic('ink:00000000-0000-0000-0000-00000000240a'), 'a stranger may not read the ink channel');
select ok(not private.can_use_topic('ink:not-a-uuid') and not private.can_send_topic('ink:not-a-uuid'), 'a bad topic is refused');
reset role;

select * from finish();
rollback;
