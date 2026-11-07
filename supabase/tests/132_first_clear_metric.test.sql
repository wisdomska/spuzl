begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- R2-ADMIN (20261202000401): landing (profile created) to first clear, per cohort day and for the range. Players are
-- made in 2034 so no other test data lands in the window; the tutorial and test players never count.
insert into auth.users (id, email, is_anonymous) values
  ('a1000000-0000-4000-8000-000000000001', null, true),
  ('a1000000-0000-4000-8000-000000000002', null, true),
  ('a1000000-0000-4000-8000-000000000003', null, true),
  ('a1000000-0000-4000-8000-000000000004', null, true);
insert into public.players (id, nickname, age_band, created_at, is_test) values
  ('a1000000-0000-4000-8000-000000000001', 'zqfc_one', '18+', '2034-05-01 10:00+00', false),
  ('a1000000-0000-4000-8000-000000000002', 'zqfc_two', '18+', '2034-05-01 11:00+00', false),
  ('a1000000-0000-4000-8000-000000000003', 'zqfc_three', '16-17', '2034-05-02 09:00+00', false),
  ('a1000000-0000-4000-8000-000000000004', 'zqfc_test', '18+', '2034-05-02 09:00+00', true);

insert into public.attempts (player_id, game_id, mode, status, started_at, finished_at) values
  -- One: a tutorial clear (not counted), then a free clear 2 minutes after landing, then a later one.
  ('a1000000-0000-4000-8000-000000000001', 'crownfall', 'tutorial', 'cleared', '2034-05-01 10:00:10+00', '2034-05-01 10:00:40+00'),
  ('a1000000-0000-4000-8000-000000000001', 'crownfall', 'free', 'cleared', '2034-05-01 10:01:00+00', '2034-05-01 10:02:00+00'),
  ('a1000000-0000-4000-8000-000000000001', 'dusk', 'free', 'cleared', '2034-05-01 12:00:00+00', '2034-05-01 12:03:00+00'),
  -- Two: only an abandoned board. Three: a free clear 10 minutes in. The test player never counts.
  ('a1000000-0000-4000-8000-000000000002', 'dusk', 'free', 'abandoned', '2034-05-01 11:01:00+00', '2034-05-01 11:02:00+00'),
  ('a1000000-0000-4000-8000-000000000003', 'dusk', 'free', 'cleared', '2034-05-02 09:05:00+00', '2034-05-02 09:10:00+00'),
  ('a1000000-0000-4000-8000-000000000004', 'dusk', 'free', 'cleared', '2034-05-02 09:00:30+00', '2034-05-02 09:01:00+00');

select is((public.svc_admin_metrics('2034-05-01', '2034-05-02') -> 'total' ->> 'fc_cohort')::int, 3, 'cohort: new players, test players left out');
select is((public.svc_admin_metrics('2034-05-01', '2034-05-02') -> 'total' ->> 'fc_cleared')::int, 2, 'cleared one: tutorials and abandoned boards do not count');
select is((public.svc_admin_metrics('2034-05-01', '2034-05-02') -> 'total' ->> 'fc_p50')::bigint, 360000::bigint,
  'range p50 of 2 and 10 minutes is 6 minutes');
select is((select (d ->> 'fc_p50')::bigint from jsonb_array_elements(public.svc_admin_metrics('2034-05-01', '2034-05-02') -> 'days') d
            where d ->> 'date' = '2034-05-01'), 120000::bigint, 'the cohort day carries its first-clear time (the first one only)');
select is((select (d ->> 'fc_cohort')::int from jsonb_array_elements(public.svc_admin_metrics('2034-05-01', '2034-05-02') -> 'days') d
            where d ->> 'date' = '2034-05-01'), 2, 'the cohort day counts its new players');
select ok(not has_function_privilege('authenticated', 'private.admin_first_clear(date, date)', 'execute'),
  'the first-clear part stays service-role only');

select * from finish();
rollback;
