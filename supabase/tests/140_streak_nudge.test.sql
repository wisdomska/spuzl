begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- R3-09 (20261207000901): streak-at-risk nudge candidates, the once-a-day send log, the alert switch, and the admin
-- Metrics part. Dates in 2035 keep other test data out of the window.
insert into auth.users (id, email, is_anonymous) values
  ('b9000000-0000-4000-8000-000000000001', null, true),
  ('b9000000-0000-4000-8000-000000000002', null, true),
  ('b9000000-0000-4000-8000-000000000003', null, true),
  ('b9000000-0000-4000-8000-000000000004', null, true),
  ('b9000000-0000-4000-8000-000000000005', null, true),
  ('b9000000-0000-4000-8000-000000000006', null, true),
  ('b9000000-0000-4000-8000-000000000007', null, true);
insert into public.players (id, nickname, age_band, country, is_test) values
  ('b9000000-0000-4000-8000-000000000001', 'zqsn_ready', '18+', 'GH', false),
  ('b9000000-0000-4000-8000-000000000002', 'zqsn_done', '18+', 'GH', false),
  ('b9000000-0000-4000-8000-000000000003', 'zqsn_nopush', '18+', 'GH', false),
  ('b9000000-0000-4000-8000-000000000004', 'zqsn_test', '18+', 'GH', true),
  ('b9000000-0000-4000-8000-000000000005', 'zqsn_banned', '18+', 'GH', false),
  ('b9000000-0000-4000-8000-000000000006', 'zqsn_off', '13-15', 'NG', false),
  ('b9000000-0000-4000-8000-000000000007', 'zqsn_short', '18+', null, false);
update public.players set banned_at = now() where id = 'b9000000-0000-4000-8000-000000000005';
insert into public.streaks (player_id, current, best, last_clear_date) values
  ('b9000000-0000-4000-8000-000000000001', 12, 12, '2035-03-04'),
  ('b9000000-0000-4000-8000-000000000002', 9, 9, '2035-03-05'),   -- already extended today
  ('b9000000-0000-4000-8000-000000000003', 9, 9, '2035-03-04'),
  ('b9000000-0000-4000-8000-000000000004', 9, 9, '2035-03-04'),
  ('b9000000-0000-4000-8000-000000000005', 9, 9, '2035-03-04'),
  ('b9000000-0000-4000-8000-000000000006', 9, 9, '2035-03-04'),
  ('b9000000-0000-4000-8000-000000000007', 1, 3, '2035-03-04')
on conflict (player_id) do update set current = excluded.current, best = excluded.best, last_clear_date = excluded.last_clear_date;
insert into public.push_subscriptions (endpoint, player_id, p256dh, auth)
select 'https://push.example/zqsn-' || n, ('b9000000-0000-4000-8000-00000000000' || n)::uuid, 'p256dh-key-x', 'auth-key-x'
from unnest(array[1, 2, 4, 5, 6, 7]) n;

create temp table c on commit drop as
  select * from public.svc_streak_nudge_candidates('2035-03-05', 2, 100) where player_id::text like 'b9000000-%';

select is((select count(*)::int from c), 2, 'two candidates: streak at risk, alerts on, not test, not banned');
select ok(exists (select 1 from c where player_id = 'b9000000-0000-4000-8000-000000000001' and streak = 12 and country = 'GH'),
  'the player with a 12-day streak and no clear today is a candidate, with their country');
select ok(not exists (select 1 from c where player_id in ('b9000000-0000-4000-8000-000000000002', 'b9000000-0000-4000-8000-000000000003',
  'b9000000-0000-4000-8000-000000000004', 'b9000000-0000-4000-8000-000000000005', 'b9000000-0000-4000-8000-000000000007')),
  'never: extended today, no device with alerts on, test, banned, or a streak under the minimum');

insert into public.alert_prefs (player_id, streak_nudge) values ('b9000000-0000-4000-8000-000000000006', false);
select ok(not exists (select 1 from public.svc_streak_nudge_candidates('2035-03-05', 2, 100)
                      where player_id = 'b9000000-0000-4000-8000-000000000006'),
  'Streak reminders off: not a candidate');

insert into public.streak_nudges (player_id, day, streak, sent_at, devices)
  values ('b9000000-0000-4000-8000-000000000001', '2035-03-05', 12, '2035-03-05 19:00+00', 1);
select throws_ok($$insert into public.streak_nudges (player_id, day, streak) values ('b9000000-0000-4000-8000-000000000001', '2035-03-05', 12)$$,
  '23505', null, 'at most one nudge per player per GMT day');
select ok(not exists (select 1 from public.svc_streak_nudge_candidates('2035-03-05', 2, 100)
                      where player_id = 'b9000000-0000-4000-8000-000000000001'),
  'nudged today: not a candidate again');
select ok(exists (select 1 from public.svc_streak_nudge_candidates('2035-03-06', 2, 100) s
                  where s.player_id = 'b9000000-0000-4000-8000-000000000002'),
  'tomorrow the player who cleared today is at risk again');

-- Metrics: nudges delivered per day, and clears within 3 hours of the push.
insert into public.streak_nudges (player_id, day, streak, sent_at, devices) values
  ('b9000000-0000-4000-8000-000000000003', '2035-03-05', 9, '2035-03-05 19:00+00', 2),
  ('b9000000-0000-4000-8000-000000000006', '2035-03-05', 9, '2035-03-05 18:00+00', 0),  -- not delivered
  ('b9000000-0000-4000-8000-000000000004', '2035-03-05', 9, '2035-03-05 19:00+00', 1),  -- test player
  ('b9000000-0000-4000-8000-000000000002', '2035-03-06', 9, '2035-03-06 19:00+00', 1);
insert into public.attempts (player_id, game_id, mode, status, started_at, finished_at) values
  ('b9000000-0000-4000-8000-000000000001', 'crownfall', 'free', 'cleared', '2035-03-05 19:30+00', '2035-03-05 19:32+00'),
  ('b9000000-0000-4000-8000-000000000003', 'crownfall', 'free', 'cleared', '2035-03-05 22:10+00', '2035-03-05 22:12+00'), -- too late
  ('b9000000-0000-4000-8000-000000000004', 'crownfall', 'free', 'cleared', '2035-03-05 19:10+00', '2035-03-05 19:12+00'),
  ('b9000000-0000-4000-8000-000000000002', 'crownfall', 'tutorial', 'cleared', '2035-03-06 19:10+00', '2035-03-06 19:12+00');

select is((public.svc_admin_metrics('2035-03-05', '2035-03-06') -> 'total' ->> 'sn_sent')::int, 3,
  'sent: delivered nudges only, test players left out');
select is((public.svc_admin_metrics('2035-03-05', '2035-03-06') -> 'total' ->> 'sn_cleared')::int, 1,
  'cleared within 3 h: a later clear or a tutorial does not count');
select is((select (d ->> 'sn_sent')::int from jsonb_array_elements(public.svc_admin_metrics('2035-03-05', '2035-03-06') -> 'days') d
            where d ->> 'date' = '2035-03-06'), 1, 'day rows carry their own nudges');
select ok((public.svc_admin_metrics('2035-03-05', '2035-03-06') -> 'total' ->> 'gr_tv_views') is not null
  and (public.svc_admin_metrics('2035-03-05', '2035-03-06') -> 'total' ->> 'go_bot_won') is not null
  and (public.svc_admin_metrics('2035-03-05', '2035-03-06') -> 'total' ->> 'fc_cohort') is not null,
  'every earlier part is still merged');

select ok(not has_function_privilege('authenticated', 'public.svc_streak_nudge_candidates(date, integer, integer)', 'execute')
  and not has_function_privilege('anon', 'public.svc_streak_nudge_candidates(date, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'private.admin_streak_nudge(date, date)', 'execute'),
  'candidates and the metric part are service-role only');
set local role authenticated;
select throws_ok($$select count(*) from public.streak_nudges$$, '42501', null, 'players cannot read the send log');
select throws_ok($$select count(*) from public.alert_prefs$$, '42501', null, 'players cannot read alert switches directly');
reset role;

select * from finish();
rollback;
