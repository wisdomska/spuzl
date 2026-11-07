begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- R2-ADMIN (20261202000701): game_over (mode bay or bot, kind won, lost or draw), counted per day and for the range.
-- 2036 dates keep other test data out of the window.
insert into public.client_metrics (name, game_id, mode, kind, created_at) values
  ('game_over', 'chess', 'bot', 'won', '2036-01-01 10:00+00'),
  ('game_over', 'chess', 'bot', 'lost', '2036-01-01 11:00+00'),
  ('game_over', 'ludo', 'bay', 'won', '2036-01-02 10:00+00'),
  ('game_over', 'ludo', 'bay', 'lost', '2036-01-02 10:00+00'),
  ('game_over', 'oware', 'bay', 'draw', '2036-01-02 12:00+00');

select lives_ok($$insert into public.client_metrics (name, created_at) values ('game_over', '2036-03-01'), ('practice_start', '2036-03-01')$$,
  'game_over is accepted, and so is every earlier name');
select throws_ok($$insert into public.client_metrics (name) values ('game_on')$$, '23514', null, 'unknown names are still refused');
select is((public.svc_admin_metrics('2036-01-01', '2036-01-02') -> 'total' ->> 'go_bot_won')::int, 1, 'range: bot wins');
select is((public.svc_admin_metrics('2036-01-01', '2036-01-02') -> 'total' ->> 'go_bay_draw')::int, 1, 'range: draws with people');
select is((select (d ->> 'go_bay_lost')::int from jsonb_array_elements(public.svc_admin_metrics('2036-01-01', '2036-01-02') -> 'days') d
            where d ->> 'date' = '2036-01-02'), 1, 'day rows carry their own results');
select ok(not has_function_privilege('authenticated', 'private.admin_game_over(date, date)', 'execute')
  and not has_function_privilege('anon', 'public.svc_admin_metrics(date, date)', 'execute'),
  'the game-over part and the metrics entry point stay service-role only');

select * from finish();
rollback;
