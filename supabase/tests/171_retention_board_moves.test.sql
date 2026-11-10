begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- R4-11 (20261210110101): a Board Bay move counts as a day's activity for retention. Cohorts in 2002 (long over, no
-- other test data in the window).
insert into auth.users (id, email, is_anonymous) values
  ('a4110000-0000-4000-8000-000000000001', null, true),
  ('a4110000-0000-4000-8000-000000000002', null, true),
  ('a4110000-0000-4000-8000-000000000003', null, true);
insert into public.players (id, nickname, age_band, is_test) values
  ('a4110000-0000-4000-8000-000000000001', 'zqbm_one', '18+', false),
  ('a4110000-0000-4000-8000-000000000002', 'zqbm_two', '18+', false),
  ('a4110000-0000-4000-8000-000000000003', 'zqbm_test', '18+', true);
insert into public.board_matches (id, game_id, mode, status, players, state, created_at) values
  ('b4110000-0000-4000-8000-000000000001', 'chess', 'async', 'active',
   array['a4110000-0000-4000-8000-000000000001', 'a4110000-0000-4000-8000-000000000003']::uuid[], '{}'::jsonb, '2002-03-01 09:00+00');
-- One: first active with a solo attempt on 1 March, back only through Board Bay moves on 2 and 8 March.
insert into public.attempts (player_id, game_id, mode, status, started_at, finished_at) values
  ('a4110000-0000-4000-8000-000000000001', 'dusk', 'free', 'cleared', '2002-03-01 10:00+00', '2002-03-01 10:02+00'),
  -- Two: only ever played solo, on 1 March.
  ('a4110000-0000-4000-8000-000000000002', 'nine', 'free', 'cleared', '2002-03-01 12:00+00', '2002-03-01 12:05+00');
insert into public.board_moves (match_id, ply, player_id, move, created_at) values
  ('b4110000-0000-4000-8000-000000000001', 1, 'a4110000-0000-4000-8000-000000000001', '{}'::jsonb, '2002-03-02 08:00+00'),
  ('b4110000-0000-4000-8000-000000000001', 2, 'a4110000-0000-4000-8000-000000000003', '{}'::jsonb, '2002-03-02 09:00+00'),
  ('b4110000-0000-4000-8000-000000000001', 3, 'a4110000-0000-4000-8000-000000000001', '{}'::jsonb, '2002-03-08 23:30+00');

select is((public.svc_admin_metrics('2002-03-01', '2002-03-01') -> 'total' ->> 'ret_cohort')::int, 2, 'cohort: two new players (the test player never counts)');
select is((public.svc_admin_metrics('2002-03-01', '2002-03-01') -> 'total' ->> 'ret_d1_kept')::int, 1, 'D1: a Board Bay move the next day counts');
select is((public.svc_admin_metrics('2002-03-01', '2002-03-01') -> 'total' ->> 'ret_d7_kept')::int, 1, 'D7: a Board Bay move 7 days later counts');
select is((public.svc_admin_metrics('2002-03-02', '2002-03-02') -> 'total' ->> 'ret_cohort')::int, 0,
  'a Board Bay move after the first day is not a new cohort member');

-- A player whose first activity ever is a Board Bay move joins that day's cohort.
insert into auth.users (id, email, is_anonymous) values ('a4110000-0000-4000-8000-000000000004', null, true);
insert into public.players (id, nickname, age_band, is_test) values ('a4110000-0000-4000-8000-000000000004', 'zqbm_four', '18+', false);
insert into public.board_moves (match_id, ply, player_id, move, created_at) values
  ('b4110000-0000-4000-8000-000000000001', 4, 'a4110000-0000-4000-8000-000000000004', '{}'::jsonb, '2002-03-05 10:00+00');
select is((public.svc_admin_metrics('2002-03-05', '2002-03-05') -> 'total' ->> 'ret_cohort')::int, 1, 'a Board Bay-only player is in the cohort of their first move');

select ok((public.svc_admin_retention(current_date) ? 'd1_cohort'), 'Live ops retention keeps its keys');
select ok(not has_function_privilege('authenticated', 'private.admin_retention_cohorts(date, date)', 'execute'),
  'the retention part stays service-role only');

select * from finish();
rollback;
