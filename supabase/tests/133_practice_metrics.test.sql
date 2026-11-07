begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- R2-ADMIN (20261202000501): practice_start, practice_finish and practice_skip, counted per day, per game and for
-- the range in svc_admin_metrics. 2035 dates keep other test data out of the window.
insert into public.client_metrics (name, game_id, created_at) values
  ('practice_start', 'dusk', '2035-02-01 10:00+00'),
  ('practice_finish', 'dusk', '2035-02-01 10:01+00'),
  ('practice_start', 'dusk', '2035-02-01 11:00+00'),
  ('practice_skip', 'dusk', '2035-02-01 11:00+00'),
  ('practice_start', 'nine', '2035-02-02 09:00+00');

select lives_ok($$insert into public.client_metrics (name, game_id, created_at) values ('practice_skip', 'sixer', '2035-03-01')$$,
  'the practice events are accepted names');
select throws_ok($$insert into public.client_metrics (name) values ('practice_cheat')$$, '23514', null,
  'unknown metric names are still refused');
select lives_ok($$insert into public.client_metrics (name, created_at) values ('daily5_share', '2035-03-01'), ('duel_created', '2035-03-01')$$,
  'every existing name is still accepted');
select is((public.svc_admin_metrics('2035-02-01', '2035-02-02') -> 'total' ->> 'practice_started')::int, 3, 'range: started');
select is(public.svc_admin_metrics('2035-02-01', '2035-02-02') -> 'total' -> 'practice_games' -> 'dusk',
  '{"started": 2, "finished": 1, "skipped": 1}'::jsonb, 'range: per game');
select is((select (d ->> 'practice_started')::int from jsonb_array_elements(public.svc_admin_metrics('2035-02-01', '2035-02-02') -> 'days') d
            where d ->> 'date' = '2035-02-02'), 1, 'day rows carry their own counts');
select ok(not has_function_privilege('authenticated', 'private.admin_practice(date, date)', 'execute'),
  'the practice part stays service-role only');

select * from finish();
rollback;
