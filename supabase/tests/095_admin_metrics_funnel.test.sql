begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Admin Metrics: onboarding_step, hint_request and hint_use client metrics (20261110000001), merged into
-- svc_admin_metrics per day and for the range. Uses 2031 dates so other test data never lands in the window.
insert into public.client_metrics (name, kind, created_at) values
  ('onboarding_step', 'hello', '2031-03-01 10:00+00'),
  ('onboarding_step', 'age', '2031-03-01 10:01+00'),
  ('onboarding_step', 'age', '2031-03-02 09:00+00'),
  ('onboarding_step', 'nickname', '2031-03-02 09:05+00'),
  ('onboarding_step', 'home', '2031-03-02 09:06+00'),
  ('hint_request', 'confirm', '2031-03-01 11:00+00'),
  ('hint_request', 'confirm', '2031-03-01 11:01+00'),
  ('hint_request', 'direct', '2031-03-02 11:00+00'),
  ('hint_use', 'direct', '2031-03-02 11:00+00'),
  ('hint_cancel', null, '2031-03-01 11:02+00');

select throws_ok($$insert into public.client_metrics (name) values ('nickname')$$, '23514', null,
  'unknown metric names are still refused');

select is((public.svc_admin_metrics('2031-03-01', '2031-03-02') -> 'total' ->> 'onboarding_age')::int, 2, 'range total: age step');
select is((public.svc_admin_metrics('2031-03-01', '2031-03-02') -> 'total' ->> 'onboarding_home')::int, 1, 'range total: reached Home');
select is((public.svc_admin_metrics('2031-03-01', '2031-03-02') -> 'total' ->> 'hint_requests')::int, 3, 'range total: hint requests');
select is((public.svc_admin_metrics('2031-03-01', '2031-03-02') -> 'total' ->> 'hint_uses')::int, 1, 'range total: hint uses');
select is((public.svc_admin_metrics('2031-03-01', '2031-03-02') -> 'total' ->> 'hint_cancels')::int, 1,
  'the older hint_cancel count is still there');

select is(jsonb_array_length(public.svc_admin_metrics('2031-03-01', '2031-03-02') -> 'days'), 2, 'one row per day');
select is((select (d ->> 'hint_requests')::int from jsonb_array_elements(public.svc_admin_metrics('2031-03-01', '2031-03-02') -> 'days') d
            where d ->> 'date' = '2031-03-01'), 2, 'day rows carry the new counts next to the old ones');
select is((select d ->> 'tap_n' from jsonb_array_elements(public.svc_admin_metrics('2031-03-01', '2031-03-02') -> 'days') d
            where d ->> 'date' = '2031-03-02'), '0', 'day rows keep the existing metrics');

select ok(not has_function_privilege('authenticated', 'private.admin_client_funnel(date, date)', 'execute')
  and not has_function_privilege('anon', 'public.svc_admin_metrics(date, date)', 'execute'),
  'the funnel and the metrics entry point stay service-role only');

select * from finish();
rollback;
