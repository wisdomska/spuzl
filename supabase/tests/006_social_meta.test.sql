begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Players: a (viewer), b (friend), c (friend who hides activity), d (stranger), t (test account), x (flagged), y (blocked)
insert into auth.users (id, email) select ('00000000-0000-0000-0000-0000000006' || c)::uuid, c || '@social.test'
  from unnest(array['0a', '0b', '0c', '0d', '0e', '0f', '10']) c;
insert into public.players (id, nickname, age_band, country, city, is_test, hide_activity) values
  ('00000000-0000-0000-0000-00000000060a', 'soc_a', '18+', 'GH', 'Accra', false, false),
  ('00000000-0000-0000-0000-00000000060b', 'soc_b', '16-17', 'GH', 'Accra', false, false),
  ('00000000-0000-0000-0000-00000000060c', 'soc_c', '13-15', 'GH', 'Accra', false, true),
  ('00000000-0000-0000-0000-00000000060d', 'soc_d', '18+', 'NG', 'Lagos', false, false),
  ('00000000-0000-0000-0000-00000000060e', 'soc_t', '18+', 'GH', 'Accra', true, false),
  ('00000000-0000-0000-0000-00000000060f', 'soc_x', '18+', 'GH', 'Accra', false, false),
  ('00000000-0000-0000-0000-000000000610', 'soc_y', '18+', 'GH', 'Accra', false, false);
insert into public.friendships (player_id, friend_id, status) values
  ('00000000-0000-0000-0000-00000000060a', '00000000-0000-0000-0000-00000000060b', 'accepted'),
  ('00000000-0000-0000-0000-00000000060c', '00000000-0000-0000-0000-00000000060a', 'accepted'),
  ('00000000-0000-0000-0000-00000000060a', '00000000-0000-0000-0000-000000000610', 'accepted');
insert into public.blocks (player_id, blocked_id) values ('00000000-0000-0000-0000-000000000610', '00000000-0000-0000-0000-00000000060a');

-- Friendships: one row per unordered pair
select throws_ok($$ insert into public.friendships (player_id, friend_id, status)
  values ('00000000-0000-0000-0000-00000000060b', '00000000-0000-0000-0000-00000000060a', 'pending') $$,
  '23505', null, 'a reverse friend request cannot duplicate an existing pair');

-- Feed: own and friends' events, minus hidden activity and blocks
insert into public.feed_events (player_id, kind, game_id, payload) values
  ('00000000-0000-0000-0000-00000000060a', 'clear', 'crownfall', '{}'),
  ('00000000-0000-0000-0000-00000000060b', 'clear', 'crownfall', '{}'),
  ('00000000-0000-0000-0000-00000000060c', 'clear', 'crownfall', '{}'),
  ('00000000-0000-0000-0000-00000000060d', 'clear', 'crownfall', '{}'),
  ('00000000-0000-0000-0000-000000000610', 'clear', 'crownfall', '{}');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000060a", "role": "authenticated"}';
select is((select count(*)::int from public.feed_events where player_id = '00000000-0000-0000-0000-00000000060a'), 1, 'own events are visible');
select is((select count(*)::int from public.feed_events where player_id = '00000000-0000-0000-0000-00000000060b'), 1, 'a friend''s events are visible');
select is((select count(*)::int from public.feed_events where player_id = '00000000-0000-0000-0000-00000000060c'), 0, 'a friend who hides activity is not in the feed');
select is((select count(*)::int from public.feed_events where player_id = '00000000-0000-0000-0000-00000000060d'), 0, 'strangers are not in the feed');
select is((select count(*)::int from public.feed_events where player_id = '00000000-0000-0000-0000-000000000610'), 0, 'a friend who blocked you is not in the feed');
select is((select count(*)::int from public.streak_frozen_days), 0, 'frozen days are own rows only');
select throws_ok($$ select * from public.svc_leaderboard('00000000-0000-0000-0000-00000000060a', 'crownfall', '2026-10-30', 'global') $$,
  '42501', null, 'clients cannot call the leaderboard service function');
select throws_ok($$ select public.svc_buy_cosmetic('00000000-0000-0000-0000-00000000060a', 'hat-party', 'r1') $$,
  '42501', null, 'clients cannot buy directly');
reset role;

-- Leaderboard: crownfall on a fixed date
insert into public.daily_results (date, game_id, player_id, time_ms, hints, mistakes, finished_at) values
  ('2026-10-30', 'crownfall', '00000000-0000-0000-0000-00000000060a', 70000, 0, 0, now()),
  ('2026-10-30', 'crownfall', '00000000-0000-0000-0000-00000000060b', 50000, 0, 0, now()),
  ('2026-10-30', 'crownfall', '00000000-0000-0000-0000-00000000060c', 60000, 0, 0, now()),
  ('2026-10-30', 'crownfall', '00000000-0000-0000-0000-00000000060d', 40000, 0, 0, now()),
  ('2026-10-30', 'crownfall', '00000000-0000-0000-0000-00000000060e', 10000, 0, 0, now()),
  ('2026-10-30', 'crownfall', '00000000-0000-0000-0000-00000000060f', 9000, 0, 0, now()),
  ('2026-10-30', 'crownfall', '00000000-0000-0000-0000-000000000610', 9500, 0, 0, now()),
  ('2026-10-30', 'dusk', '00000000-0000-0000-0000-00000000060a', 30000, 0, 0, now());
insert into public.attempts (player_id, game_id, mode, daily_date, status) values
  ('00000000-0000-0000-0000-00000000060f', 'crownfall', 'daily', '2026-10-30', 'flagged');

select is((select string_agg(nickname, ',' order by pos) from public.svc_leaderboard('00000000-0000-0000-0000-00000000060a', 'crownfall', '2026-10-30', 'global')),
  'soc_d,soc_b,soc_c,soc_a', 'global board: fastest first; flagged, test and blocked players never show');
select is((select pos from public.svc_leaderboard('00000000-0000-0000-0000-00000000060a', 'crownfall', '2026-10-30', 'global') where is_me), 4, 'the viewer row is marked');
select is((select string_agg(nickname, ',' order by pos) from public.svc_leaderboard('00000000-0000-0000-0000-00000000060a', 'crownfall', '2026-10-30', 'friends')),
  'soc_b,soc_c,soc_a', 'friends board holds friends and you');
select is((select string_agg(nickname, ',' order by pos) from public.svc_leaderboard('00000000-0000-0000-0000-00000000060a', 'crownfall', '2026-10-30', 'city')),
  'soc_b,soc_a', 'city board: same city, never under-16s');
select is((select count(*)::int from public.svc_leaderboard('00000000-0000-0000-0000-00000000060a', 'crownfall', '2026-10-30', 'crew')), 0, 'no crew, empty crew board');
select is((select clears from public.svc_leaderboard('00000000-0000-0000-0000-00000000060a', null, '2026-10-30', 'global') where is_me), 2, 'overall board counts clears for the day');
select is((select pos from public.svc_leaderboard('00000000-0000-0000-0000-00000000060a', null, '2026-10-30', 'global') where is_me), 1, 'overall board ranks more clears first');
select is((select count(*)::int from public.svc_leaderboard('00000000-0000-0000-0000-00000000060a', 'crownfall', '2026-10-30', 'global', 1)), 2, 'limit keeps the top rows plus you');

-- Shop
update public.players set sparks = 400 where id = '00000000-0000-0000-0000-00000000060a';
select is((select public.svc_buy_cosmetic('00000000-0000-0000-0000-00000000060a', 'hat-party', 'r1') ->> 'status'), 'bought', 'buys an item');
select is((select public.svc_buy_cosmetic('00000000-0000-0000-0000-00000000060a', 'hat-party', 'r1') ->> 'status'), 'duplicate', 'a retried purchase is not charged twice');
select is((select sparks::int from public.players where id = '00000000-0000-0000-0000-00000000060a'), 100, 'Sparks are spent once');
select throws_like($$ select public.svc_buy_cosmetic('00000000-0000-0000-0000-00000000060a', 'freeze', 'r2') $$, '%not enough sparks%', 'not enough Sparks is refused');
select throws_like($$ select public.svc_buy_cosmetic('00000000-0000-0000-0000-00000000060a', 'hat-party', 'r3') $$, '%owned%', 'cannot buy an owned item twice');

-- Streak Freeze use is recorded for the calendar; a milestone posts to the feed
insert into public.streaks (player_id, current, best, last_clear_date, freezes_held) values ('00000000-0000-0000-0000-00000000060b', 6, 6, '2026-10-28', 1);
update public.streaks set freezes_held = 0, last_clear_date = '2026-10-29' where player_id = '00000000-0000-0000-0000-00000000060b';
select is((select day::text from public.streak_frozen_days where player_id = '00000000-0000-0000-0000-00000000060b'), '2026-10-29', 'a spent Freeze marks the covered day');
update public.streaks set current = 7 where player_id = '00000000-0000-0000-0000-00000000060b';
select is((select count(*)::int from public.feed_events where player_id = '00000000-0000-0000-0000-00000000060b' and kind = 'streak'), 1, 'a 7 day streak posts to the feed');

select * from finish();
rollback;
