begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Round 3 item 13 (20261207001301): distinct players with push alerts on, and reached since a time, test players out.
create temp table base as select public.svc_admin_push_players('2036-01-01') as v, public.svc_admin_push_players('2035-11-01') as early;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000d131', 'push-a@example.test'),
  ('00000000-0000-0000-0000-00000000d132', 'push-b@example.test'),
  ('00000000-0000-0000-0000-00000000d133', 'push-t@example.test');
insert into public.players (id, nickname, age_band, is_test) values
  ('00000000-0000-0000-0000-00000000d131', 'push_a131', '18+', false),
  ('00000000-0000-0000-0000-00000000d132', 'push_b132', '18+', false),
  ('00000000-0000-0000-0000-00000000d133', 'push_t133', '18+', true)
on conflict (id) do update set is_test = excluded.is_test;
insert into public.push_subscriptions (endpoint, player_id, p256dh, auth, last_ok_at) values
  -- player A: two devices, one reached after the cut-off
  ('https://push.example.test/a1', '00000000-0000-0000-0000-00000000d131', 'k', 'a', '2036-02-01'),
  ('https://push.example.test/a2', '00000000-0000-0000-0000-00000000d131', 'k', 'a', '2036-02-02'),
  -- player B: one device, reached only before the cut-off
  ('https://push.example.test/b1', '00000000-0000-0000-0000-00000000d132', 'k', 'a', '2035-12-01'),
  -- a test player: never counted
  ('https://push.example.test/t1', '00000000-0000-0000-0000-00000000d133', 'k', 'a', '2036-02-01');

select is((public.svc_admin_push_players('2036-01-01') ->> 'players_on')::int - ((select v from base) ->> 'players_on')::int, 2,
  'players with alerts on: each player once, however many devices, test players left out');
select is((public.svc_admin_push_players('2036-01-01') ->> 'players_reached')::int - ((select v from base) ->> 'players_reached')::int, 1,
  'players reached since the cut-off: once each, test players left out');
select is((public.svc_admin_push_players('2035-11-01') ->> 'players_reached')::int - ((select early from base) ->> 'players_reached')::int, 2,
  'an earlier cut-off counts player B too');

select ok(not has_function_privilege('authenticated', 'public.svc_admin_push_players(timestamptz)', 'execute'),
  'players cannot call it');
select ok(not has_function_privilege('anon', 'public.svc_admin_push_players(timestamptz)', 'execute'), 'visitors cannot call it');
select ok(has_function_privilege('service_role', 'public.svc_admin_push_players(timestamptz)', 'execute'),
  'the service role can');

select * from finish();
rollback;
