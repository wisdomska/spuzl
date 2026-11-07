begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- R2-ADMIN (20261202000301): tap_to_board cold (first board of the page session, or a cold page load) and warm (later
-- boards), merged into svc_admin_metrics per day and for the range. 2033 dates keep other test data out of the window.
insert into public.client_metrics (name, kind, value_ms, warm, created_at) values
  ('tap_to_board', 'load', 3000, false, '2033-03-01 10:00+00'),
  ('tap_to_board', 'tap', 2000, false, '2033-03-01 10:01+00'),
  ('tap_to_board', 'tap', 400, true, '2033-03-01 10:02+00'),
  ('tap_to_board', 'tap', 600, true, '2033-03-02 10:00+00'),
  ('tap_to_board', 'tap', 9000, null, '2033-03-02 10:00+00');

select has_column('public', 'client_metrics', 'warm', 'client_metrics.warm exists');
select is((public.svc_admin_metrics('2033-03-01', '2033-03-02') -> 'total' ->> 'cold_n')::int, 2, 'range: cold count (load + first tap)');
select is((public.svc_admin_metrics('2033-03-01', '2033-03-02') -> 'total' ->> 'cold_p50')::int, 2500, 'range: cold p50');
select is((public.svc_admin_metrics('2033-03-01', '2033-03-02') -> 'total' ->> 'warm_n')::int, 2, 'range: warm count (older taps left out)');
select is((select (d ->> 'warm_p50')::int from jsonb_array_elements(public.svc_admin_metrics('2033-03-01', '2033-03-02') -> 'days') d
            where d ->> 'date' = '2033-03-02'), 600, 'day rows carry the warm p50');
select is((public.svc_admin_metrics('2033-03-01', '2033-03-02') -> 'total' ->> 'tap_n')::int, 4,
  'the existing Tap to board numbers are unchanged (every tap, warm or not)');
select ok(not has_function_privilege('authenticated', 'private.admin_tap_warmth(date, date)', 'execute')
  and not has_function_privilege('anon', 'public.svc_admin_metrics(date, date)', 'execute'),
  'the warmth part and the metrics entry point stay service-role only');

select * from finish();
rollback;
