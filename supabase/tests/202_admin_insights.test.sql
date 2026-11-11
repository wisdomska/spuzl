begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

-- Admin overhaul B (20261211020101): private.admin_insights, merged into svc_admin_metrics. Data in May 2003 (no other
-- test data there). The session runs in a far-off time zone to prove every day is a GMT day.
set local timezone = 'America/Los_Angeles';

create temp table st as
  select (private.admin_insights('2003-05-10', '2003-05-12') -> 'total' ->> 'streak_3')::int as s3,
         (private.admin_insights('2003-05-10', '2003-05-12') -> 'total' ->> 'streak_7')::int as s7;

insert into auth.users (id, email, is_anonymous) values
  ('b2020000-0000-4000-8000-000000000001', null, true),
  ('b2020000-0000-4000-8000-000000000002', 'two@example.com', false),
  ('b2020000-0000-4000-8000-000000000003', null, true),
  ('b2020000-0000-4000-8000-000000000004', 'four@example.com', false),
  ('b2020000-0000-4000-8000-000000000005', 'five@example.com', false);
-- 1 guest, new on 10 May; 2 saved, new on 9 May; 3 a test player, new on 10 May; 4 saved, new on 3 May;
-- 5 saved, new on 11 May and never plays.
insert into public.players (id, nickname, age_band, is_test, is_guest, created_at) values
  ('b2020000-0000-4000-8000-000000000001', 'zqin_one', '18+', false, true, '2003-05-10 09:00+00'),
  ('b2020000-0000-4000-8000-000000000002', 'zqin_two', '18+', false, false, '2003-05-09 09:00+00'),
  ('b2020000-0000-4000-8000-000000000003', 'zqin_test', '18+', true, true, '2003-05-10 09:00+00'),
  ('b2020000-0000-4000-8000-000000000004', 'zqin_four', '18+', false, false, '2003-05-03 09:00+00'),
  ('b2020000-0000-4000-8000-000000000005', 'zqin_five', '18+', false, false, '2003-05-11 09:00+00');

insert into public.attempts (player_id, game_id, mode, status, started_at) values
  ('b2020000-0000-4000-8000-000000000001', 'dusk', 'tutorial', 'cleared', '2003-05-10 10:00+00'),
  ('b2020000-0000-4000-8000-000000000001', 'dusk', 'free', 'cleared', '2003-05-10 10:05+00'),
  ('b2020000-0000-4000-8000-000000000002', 'nine', 'free', 'failed', '2003-05-09 12:00+00'),
  ('b2020000-0000-4000-8000-000000000002', 'nine', 'duel', 'in_progress', '2003-05-12 12:00+00'),
  ('b2020000-0000-4000-8000-000000000004', 'dusk', 'free', 'cleared', '2003-05-03 12:00+00'),
  -- the last second of 10 May GMT, and a start that is 13 May in GMT (outside the range)
  ('b2020000-0000-4000-8000-000000000004', 'dusk', 'free', 'in_progress', '2003-05-10 23:59:59+00'),
  ('b2020000-0000-4000-8000-000000000004', 'dusk', 'free', 'in_progress', '2003-05-12 23:30-02'),
  ('b2020000-0000-4000-8000-000000000003', 'dusk', 'free', 'cleared', '2003-05-10 10:00+00');

-- Board games: vs the computer (counted), with the test player (not a game, but player 1's play counts), no moves.
insert into public.board_matches (id, game_id, mode, status, players, state, bot, created_at) values
  ('b2020000-0000-4000-8000-0000000000b1', 'chess', 'live', 'finished',
   array['b2020000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000']::uuid[], '{}'::jsonb, true, '2003-05-11 08:00+00'),
  ('b2020000-0000-4000-8000-0000000000b2', 'chess', 'async', 'active',
   array['b2020000-0000-4000-8000-000000000001', 'b2020000-0000-4000-8000-000000000003']::uuid[], '{}'::jsonb, false, '2003-05-11 08:00+00'),
  ('b2020000-0000-4000-8000-0000000000b3', 'chess', 'async', 'waiting',
   array['b2020000-0000-4000-8000-000000000002']::uuid[], '{}'::jsonb, false, '2003-05-12 08:00+00');
insert into public.board_moves (match_id, ply, player_id, move, created_at) values
  ('b2020000-0000-4000-8000-0000000000b1', 1, 'b2020000-0000-4000-8000-000000000001', '{}'::jsonb, '2003-05-11 08:01+00'),
  ('b2020000-0000-4000-8000-0000000000b1', 3, 'b2020000-0000-4000-8000-000000000001', '{}'::jsonb, '2003-05-11 08:03+00'),
  ('b2020000-0000-4000-8000-0000000000b2', 1, 'b2020000-0000-4000-8000-000000000001', '{}'::jsonb, '2003-05-11 09:00+00'),
  ('b2020000-0000-4000-8000-0000000000b2', 2, 'b2020000-0000-4000-8000-000000000003', '{}'::jsonb, '2003-05-11 09:05+00');

-- Duels: one finished vs the computer, one still in the lobby, one with the test player. Party: started then abandoned.
insert into public.matches (id, kind, status, is_bot, created_at, round_started_at) values
  ('b2020000-0000-4000-8000-0000000000d1', 'duel', 'finished', true, '2003-05-10 11:00+00', '2003-05-10 11:01+00'),
  ('b2020000-0000-4000-8000-0000000000d2', 'duel', 'lobby', false, '2003-05-10 11:00+00', null),
  ('b2020000-0000-4000-8000-0000000000d3', 'duel', 'finished', false, '2003-05-10 11:00+00', '2003-05-10 11:01+00'),
  -- a computer duel that never started: in the older Duels card's bot count, not in duels played
  ('b2020000-0000-4000-8000-0000000000d4', 'duel', 'queue', true, '2003-05-10 11:00+00', null),
  ('b2020000-0000-4000-8000-0000000000e1', 'race', 'abandoned', false, '2003-05-12 11:00+00', '2003-05-12 11:01+00');
insert into public.match_players (match_id, player_id, spectator) values
  ('b2020000-0000-4000-8000-0000000000d1', 'b2020000-0000-4000-8000-000000000001', false),
  ('b2020000-0000-4000-8000-0000000000d2', 'b2020000-0000-4000-8000-000000000002', false),
  ('b2020000-0000-4000-8000-0000000000d3', 'b2020000-0000-4000-8000-000000000002', false),
  ('b2020000-0000-4000-8000-0000000000d3', 'b2020000-0000-4000-8000-000000000003', false),
  ('b2020000-0000-4000-8000-0000000000d4', 'b2020000-0000-4000-8000-000000000002', false),
  ('b2020000-0000-4000-8000-0000000000e1', 'b2020000-0000-4000-8000-000000000002', false),
  ('b2020000-0000-4000-8000-0000000000e1', 'b2020000-0000-4000-8000-000000000004', false),
  ('b2020000-0000-4000-8000-0000000000e1', 'b2020000-0000-4000-8000-000000000001', true);

insert into public.friendships (player_id, friend_id, status, created_at) values
  ('b2020000-0000-4000-8000-000000000001', 'b2020000-0000-4000-8000-000000000002', 'accepted', '2003-05-10 12:00+00'),
  ('b2020000-0000-4000-8000-000000000002', 'b2020000-0000-4000-8000-000000000004', 'pending', '2003-05-10 12:00+00'),
  ('b2020000-0000-4000-8000-000000000001', 'b2020000-0000-4000-8000-000000000003', 'accepted', '2003-05-10 12:00+00');

insert into public.sparks_ledger (player_id, source, ref_id, amount, created_at) values
  ('b2020000-0000-4000-8000-000000000001', 'daily', 'zqin-1', 50, '2003-05-10 12:00+00'),
  ('b2020000-0000-4000-8000-000000000001', 'shop', 'zqin-2', -30, '2003-05-10 12:05+00'),
  ('b2020000-0000-4000-8000-000000000002', 'admin', 'zqin-3', 100, '2003-05-11 12:00+00'),
  ('b2020000-0000-4000-8000-000000000002', 'shop', 'zqin-4', -100, '2003-05-12 12:00+00'),
  ('b2020000-0000-4000-8000-000000000003', 'daily', 'zqin-5', 999, '2003-05-10 12:00+00');

insert into public.reports (reporter_id, target_type, target_id, reason, created_at) values
  ('b2020000-0000-4000-8000-000000000001', 'player', 'b2020000-0000-4000-8000-000000000002', 'spam', '2003-05-10 13:00+00'),
  ('b2020000-0000-4000-8000-000000000003', 'player', 'b2020000-0000-4000-8000-000000000002', 'spam', '2003-05-10 13:00+00');
insert into public.feedback (player_id, kind, message, created_at) values
  (null, 'idea', 'Signed out and loving it', '2003-05-11 13:00+00'),
  ('b2020000-0000-4000-8000-000000000003', 'bug', 'A test player message', '2003-05-11 13:00+00'),
  ('b2020000-0000-4000-8000-000000000002', 'bug', 'A real player message', '2003-05-12 13:00+00');

insert into public.streaks (player_id, current, best) values
  ('b2020000-0000-4000-8000-000000000001', 3, 3),
  ('b2020000-0000-4000-8000-000000000004', 8, 8),
  ('b2020000-0000-4000-8000-000000000003', 10, 10);

create temp table r as select public.svc_admin_metrics('2003-05-10', '2003-05-12') as v;
create temp table t as select v -> 'total' as v from r;
create temp table dd as select (e ->> 'date') as d, e as v from r, jsonb_array_elements(r.v -> 'days') e;

-- How many play
select is((select (v ->> 'active')::int from t), 3, 'players: 1, 2 and 4 once each over the range (test player left out)');
select is((select (v ->> 'active_saved')::int from t), 2, 'players with a saved account: 2 and 4');
select is((select (v ->> 'active')::int from dd where d = '2003-05-10'), 2, '10 May: 1 (tutorial and free) and 4 (23:59:59 GMT)');
select is((select (v ->> 'active')::int from dd where d = '2003-05-11'), 1, '11 May: a board-game move counts');
select is((select (v ->> 'active')::int from dd where d = '2003-05-12'), 1, '12 May: 2 only (4''s 01:30 GMT start on 13 May is outside)');
select is((select (v ->> 'active_last7')::int from t), 3, 'a range under 7 days: the last 7 days are the whole range');
select is((select (v ->> 'created')::int from t), 2, 'new players: 1 and 5 (not the test player, not 2 from 9 May)');
select is((select (v ->> 'new_saved')::int from t), 1, 'new players with a saved account: 5');
select is((select (v ->> 'new_saved')::int from dd where d = '2003-05-11'), 1, 'new saved, by day');

-- Come back (measured on each day of the range)
select is((select (v ->> 'rt_d1_cohort')::int from dd where d = '2003-05-10'), 1, 'next day on 10 May: 2 (first played 9 May)');
select is((select (v ->> 'rt_d1_kept')::int from dd where d = '2003-05-10'), 0, '2 did not play on 10 May');
select is((select (v ->> 'rt_d1_cohort')::int from dd where d = '2003-05-11'), 1, 'next day on 11 May: 1 (first played 10 May; test player left out)');
select is((select (v ->> 'rt_d1_kept')::int from dd where d = '2003-05-11'), 1, '1 came back on 11 May with a board-game move');
select is((select (v ->> 'rt_d1_cohort')::int from t), 2, 'next day, range total');
select is((select (v ->> 'rt_d1_kept')::int from t), 1, 'next day kept, range total');
select is((select (v ->> 'rt_d7_cohort')::int from dd where d = '2003-05-10'), 1, 'a week later on 10 May: 4 (first played 3 May)');
select is((select (v ->> 'rt_d7_kept')::int from dd where d = '2003-05-10'), 1, '4 played on 10 May');
select is((select (v ->> 'rt_d7_cohort')::int from t), 1, 'a week later, range total');
select is((select (v ->> 'streak_3')::int from t) - (select s3 from st), 2, 'streaks of 3+ now: 1 and 4 (not the test player)');
select is((select (v ->> 'streak_7')::int from t) - (select s7 from st), 1, 'streaks of 7+ now: 4');

-- What they play
select is((select (v ->> 'puzzles_started')::int from t), 3, 'puzzles: 1 free, 4 free, 2 duel round (no tutorial, no test, not 13 May)');
select is((select (v ->> 'puzzles_cleared')::int from t), 1, 'puzzles cleared: 1');
select is((select (v ->> 'board_plays')::int from t), 2, 'board plays: 1 in each game (one per player per game)');
select is((select (v ->> 'board_games')::int from t), 1, 'board games: the one vs the computer (with a test player or no moves do not count)');
select is((select (v ->> 'board_bot_games')::int from t), 1, 'board games vs the computer');
select is((select v -> 'top_games' -> 'dusk' from t), '{"plays": 2, "players": 2}'::jsonb, 'top games: dusk');
select is((select v -> 'top_games' -> 'chess' from t), '{"plays": 2, "players": 1}'::jsonb, 'top games: chess');

-- Together
select is((select (v ->> 'duels')::int from t), 1, 'duels: the finished one (not the lobby or queue, not with a test player)');
select is((select (v ->> 'duels_bot')::int from t), 2, 'the older Duels card keeps its own computer count');
select is((select (v ->> 'duels_vs_computer')::int from t), 1, 'duels vs the computer');
select is((select count(*)::int from (values
    (private.admin_metrics('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_client_funnel('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_duel_bands('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_party_metrics('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_prompt_metrics('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_daily_five('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_tap_warmth('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_first_clear('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_practice('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_retention_cohorts('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_game_over('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_growth('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_streak_nudge('2003-05-10', '2003-05-12') -> 'total'),
    (private.admin_weekly_recap('2003-05-10', '2003-05-12') -> 'total')) p(v), jsonb_each(p.v) e
  where (select v from t) -> e.key is distinct from e.value), 0, 'no new key overwrites an older Metrics number');
select is((select (v ->> 'parties')::int from t), 1, 'a Party that started counts even if abandoned later');
select is((select (v ->> 'party_players')::int from t), 2, 'party players: not the spectator');
select is((select (v ->> 'friends_made')::int from t), 1, 'friends: accepted only, not with a test player');

-- Sparks, shop, community
select is((select (v ->> 'sparks_earned')::int from t), 50, 'Sparks earned: not team gifts, not test players');
select is((select (v ->> 'sparks_spent')::int from t), 130, 'Sparks spent');
select is((select (v ->> 'shop_buys')::int from t), 2, 'shop purchases');
select is((select (v ->> 'shop_buyers')::int from t), 2, 'shop buyers');
select is((select (v ->> 'reports_sent')::int from t), 1, 'reports: not from a test player');
select is((select (v ->> 'feedback_sent')::int from t), 2, 'feedback: signed-out counts, a test player does not');

-- One day, and a range with nothing in it
select is((public.svc_admin_metrics('2003-05-10', '2003-05-10') -> 'total' ->> 'active')::int, 2, 'a one-day range');
select is(public.svc_admin_metrics('1990-01-01', '1990-01-07') -> 'total' -> 'top_games', '{}'::jsonb, 'an empty range: no games, zeros elsewhere');

-- Live now uses the same activity rule: a board-game move counts.
select is((public.svc_admin_kpis('2003-05-11') ->> 'dau')::int, 1, 'Live now, played today: a board-game move counts');
select is((public.svc_admin_kpis('2003-05-11') ->> 'dau_yesterday')::int, 2, 'Live now, yesterday: 1 and 4 (not the test player)');
select ok((public.svc_admin_kpis('2003-05-11') ?& array['players_now', 'clears_today', 'flagged', 'open_reports', 'banned', 'dau_last_week']),
  'Live now keeps every other number');
select is((select players::int from public.svc_admin_activity_series('2003-05-11 09:10+00') where slot_start = '2003-05-11 08:00+00'), 1,
  'players per half hour: board-game moves count');
select is((select players::int from public.svc_admin_activity_series('2003-05-11 09:10+00') where slot_start = '2003-05-11 09:00+00'), 1,
  'the current half hour, without the test player');
select is((select count(*)::int from public.svc_admin_activity_series('2003-05-11 09:10+00')), 48, 'still 48 half hours');

select ok(not has_function_privilege('authenticated', 'private.admin_insights(date, date)', 'execute'),
  'the new part is service-role only');

select * from finish();
rollback;
