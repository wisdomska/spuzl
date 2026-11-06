begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- R2-02: duel_created by age band (20261130100201), merged into svc_admin_metrics per day and for the range.
-- Uses 2032 dates so other test data never lands in the window.
insert into public.client_metrics (name, kind, band, created_at) values
  ('duel_created', 'friend', '13-15', '2032-04-01 10:00+00'),
  ('duel_created', 'friend', '13-15', '2032-04-01 10:01+00'),
  ('duel_created', 'friend', '18+', '2032-04-02 09:00+00'),
  ('duel_created', 'quick', '16-17', '2032-04-02 09:05+00'),
  ('duel_created', 'quick', '18+', '2032-04-02 09:06+00');

select throws_ok($$insert into public.client_metrics (name, kind, band) values ('duel_created', 'friend', '12')$$, '23514', null,
  'only known age bands are stored');

select is((public.svc_admin_metrics('2032-04-01', '2032-04-02') -> 'total' ->> 'duels_friend_1315')::int, 2, 'range total: under-16 friend duels');
select is((public.svc_admin_metrics('2032-04-01', '2032-04-02') -> 'total' ->> 'duels_quick_1315')::int, 0, 'range total: no under-16 Quick Match');
select is((public.svc_admin_metrics('2032-04-01', '2032-04-02') -> 'total' ->> 'duels_quick_18')::int, 1, 'range total: adult Quick Match');
select is((select (d ->> 'duels_friend_18')::int from jsonb_array_elements(public.svc_admin_metrics('2032-04-01', '2032-04-02') -> 'days') d
            where d ->> 'date' = '2032-04-02'), 1, 'day rows carry the band counts');
select is((select d ->> 'tap_n' from jsonb_array_elements(public.svc_admin_metrics('2032-04-01', '2032-04-02') -> 'days') d
            where d ->> 'date' = '2032-04-01'), '0', 'day rows keep the existing metrics');
select ok(not has_function_privilege('authenticated', 'private.admin_duel_bands(date, date)', 'execute'),
  'the band counts stay service-role only');

select * from finish();
rollback;
