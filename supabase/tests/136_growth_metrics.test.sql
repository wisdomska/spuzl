begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- R2-P5 (20261204000701, school_join removed in 20261206000101): party_tv_view and streak_shield, per day and range.
-- 2036 dates keep other test data out of the window.
insert into public.client_metrics (name, kind, created_at) values
  ('party_tv_view', null, '2036-02-01 10:00+00'),
  ('party_tv_view', null, '2036-02-02 10:00+00'),
  ('streak_shield', null, '2036-02-02 11:00+00');

select lives_ok($$insert into public.client_metrics (name, created_at) values ('streak_shield', '2036-03-01'), ('game_over', '2036-03-01')$$,
  'the new names are accepted, and so is every earlier name');
select throws_ok($$insert into public.client_metrics (name) values ('school_join')$$, '23514', null, 'unknown names are still refused');
select is((public.svc_admin_metrics('2036-02-01', '2036-02-02') -> 'total' ->> 'gr_tv_views')::int, 2, 'range: TV views');
select is((select (d ->> 'gr_shields')::int from jsonb_array_elements(public.svc_admin_metrics('2036-02-01', '2036-02-02') -> 'days') d
            where d ->> 'date' = '2036-02-02'), 1, 'day rows carry their own shields');
select ok(not has_function_privilege('authenticated', 'private.admin_growth(date, date)', 'execute')
  and (public.svc_admin_metrics('2036-02-01', '2036-02-02') -> 'total' ->> 'go_bot_won') is not null,
  'the growth part is service-role only, and the earlier parts are still merged');

select * from finish();
rollback;
