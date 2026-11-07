begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- R2-ADMIN (20261202000601): D1 and D7 retention by cohort day (the first attempt's GMT day). The cohorts are in 2001
-- so every D1 and D7 day is long over and no other test data lands in the window.
insert into auth.users (id, email, is_anonymous) values
  ('a2000000-0000-4000-8000-000000000001', null, true),
  ('a2000000-0000-4000-8000-000000000002', null, true),
  ('a2000000-0000-4000-8000-000000000003', null, true),
  ('a2000000-0000-4000-8000-000000000004', null, true);
insert into public.players (id, nickname, age_band, is_test) values
  ('a2000000-0000-4000-8000-000000000001', 'zqrc_one', '18+', false),
  ('a2000000-0000-4000-8000-000000000002', 'zqrc_two', '18+', false),
  ('a2000000-0000-4000-8000-000000000003', 'zqrc_three', '16-17', false),
  ('a2000000-0000-4000-8000-000000000004', 'zqrc_test', '18+', true);
insert into public.attempts (player_id, game_id, mode, status, started_at, finished_at) values
  -- One: first on 1 March, back on 2 March (D1) and on 8 March (D7).
  ('a2000000-0000-4000-8000-000000000001', 'dusk', 'free', 'cleared', '2001-03-01 10:00+00', '2001-03-01 10:02+00'),
  ('a2000000-0000-4000-8000-000000000001', 'dusk', 'free', 'cleared', '2001-03-02 10:00+00', '2001-03-02 10:02+00'),
  ('a2000000-0000-4000-8000-000000000001', 'dusk', 'free', 'abandoned', '2001-03-08 23:00+00', '2001-03-08 23:01+00'),
  -- Two: first on 1 March, never back. Three: first on 2 March, back on 3 March only. The test player never counts.
  ('a2000000-0000-4000-8000-000000000002', 'nine', 'free', 'cleared', '2001-03-01 12:00+00', '2001-03-01 12:05+00'),
  ('a2000000-0000-4000-8000-000000000003', 'nine', 'free', 'cleared', '2001-03-02 12:00+00', '2001-03-02 12:05+00'),
  ('a2000000-0000-4000-8000-000000000003', 'nine', 'free', 'cleared', '2001-03-03 00:30+00', '2001-03-03 00:35+00'),
  ('a2000000-0000-4000-8000-000000000004', 'nine', 'free', 'cleared', '2001-03-01 12:00+00', '2001-03-01 12:05+00'),
  ('a2000000-0000-4000-8000-000000000004', 'nine', 'free', 'cleared', '2001-03-02 12:00+00', '2001-03-02 12:05+00');

select is((public.svc_admin_metrics('2001-03-01', '2001-03-02') -> 'total' ->> 'ret_cohort')::int, 3, 'range cohort: three new players');
select is((public.svc_admin_metrics('2001-03-01', '2001-03-02') -> 'total' ->> 'ret_d1_kept')::int, 2, 'range: two came back the next day');
select is((public.svc_admin_metrics('2001-03-01', '2001-03-02') -> 'total' ->> 'ret_d7_kept')::int, 1, 'range: one came back 7 days later');
select is((select (d ->> 'ret_cohort')::int from jsonb_array_elements(public.svc_admin_metrics('2001-03-01', '2001-03-02') -> 'days') d
            where d ->> 'date' = '2001-03-01'), 2, 'the cohort day counts its own first-timers');
select is((select (d ->> 'ret_cohort')::int from jsonb_array_elements(public.svc_admin_metrics('2001-03-02', '2001-03-02') -> 'days') d),
  1, 'a returning player is not a new cohort member on a later day');
select is((public.svc_admin_metrics(current_date - 1, current_date) -> 'total' ->> 'ret_d7_cohort')::int, 0,
  'recent days are not yet due for D7');
select ok(not has_function_privilege('authenticated', 'private.admin_retention_cohorts(date, date)', 'execute'),
  'the retention part stays service-role only');

select * from finish();
rollback;
