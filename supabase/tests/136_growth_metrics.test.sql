begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- R2-P5 (20261204000701): party_tv_view, streak_shield and school_join, counted per day and for the range.
-- 2036 dates keep other test data out of the window.
insert into public.client_metrics (name, kind, created_at) values
  ('party_tv_view', null, '2036-02-01 10:00+00'),
  ('party_tv_view', null, '2036-02-02 10:00+00'),
  ('streak_shield', null, '2036-02-02 11:00+00'),
  ('school_join', 'campus', '2036-02-02 12:00+00');

select lives_ok($$insert into public.client_metrics (name, created_at) values ('school_join', '2036-03-01'), ('game_over', '2036-03-01')$$,
  'the new names are accepted, and so is every earlier name');
select throws_ok($$insert into public.client_metrics (name) values ('party_tv')$$, '23514', null, 'unknown names are still refused');
select is((public.svc_admin_metrics('2036-02-01', '2036-02-02') -> 'total' ->> 'gr_tv_views')::int, 2, 'range: TV views');
select is((select (d ->> 'gr_school_joins')::int from jsonb_array_elements(public.svc_admin_metrics('2036-02-01', '2036-02-02') -> 'days') d
            where d ->> 'date' = '2036-02-02'), 1, 'day rows carry their own joins');
select ok(not has_function_privilege('authenticated', 'private.admin_growth(date, date)', 'execute')
  and (public.svc_admin_metrics('2036-02-01', '2036-02-02') -> 'total' ->> 'go_bot_won') is not null,
  'the growth part is service-role only, and the earlier parts are still merged');

select * from finish();
rollback;
