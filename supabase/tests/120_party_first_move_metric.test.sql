begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- R2-03 Admin Metrics: party_first_move client metrics (20261130100301), merged into svc_admin_metrics per day and for
-- the range with p50 and p95. Uses 2032 dates so other test data never lands in the window.
insert into public.client_metrics (name, game_id, mode, value_ms, created_at) values
  ('party_first_move', 'crownfall', 'race', 400, '2032-04-01 10:00+00'),
  ('party_first_move', 'crownfall', 'race', 800, '2032-04-01 10:00+00'),
  ('party_first_move', 'sixer', 'race', 1200, '2032-04-01 10:01+00'),
  ('party_first_move', 'sixer', 'race', 2000, '2032-04-02 09:00+00'),
  ('hint_request', null, null, null, '2032-04-02 09:00+00');

select lives_ok($$insert into public.client_metrics (name, value_ms, created_at) values ('party_first_move', 10, '2032-05-01')$$,
  'party_first_move is an accepted metric name');
select throws_ok($$insert into public.client_metrics (name) values ('party_last_move')$$, '23514', null,
  'unknown metric names are still refused');

select is((public.svc_admin_metrics('2032-04-01', '2032-04-02') -> 'total' ->> 'party_first_move_n')::int, 4, 'range total: count');
select is((public.svc_admin_metrics('2032-04-01', '2032-04-02') -> 'total' ->> 'party_first_move_p50')::int, 1000, 'range total: p50');
select is((select (d ->> 'party_first_move_p50')::int from jsonb_array_elements(public.svc_admin_metrics('2032-04-01', '2032-04-02') -> 'days') d
            where d ->> 'date' = '2032-04-01'), 800, 'day rows carry p50');
select is((select (d ->> 'hint_requests')::int from jsonb_array_elements(public.svc_admin_metrics('2032-04-01', '2032-04-02') -> 'days') d
            where d ->> 'date' = '2032-04-02'), 1, 'day rows keep the funnel counts');
select is((select d ->> 'party_first_move_p95' from jsonb_array_elements(public.svc_admin_metrics('2032-04-03', '2032-04-03') -> 'days') d), null,
  'a day with no first moves has no percentile');

select ok(not has_function_privilege('authenticated', 'private.admin_party_metrics(date, date)', 'execute')
  and not has_function_privilege('anon', 'public.svc_admin_metrics(date, date)', 'execute'),
  'the party metrics and the metrics entry point stay service-role only');

select * from finish();
rollback;
