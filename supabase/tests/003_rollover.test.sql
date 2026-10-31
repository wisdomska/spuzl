begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'd1@test'), ('00000000-0000-0000-0000-0000000000d2', 'd2@test'), ('00000000-0000-0000-0000-0000000000d3', 'd3@test');
insert into public.players (id, nickname, age_band) values
  ('00000000-0000-0000-0000-0000000000d1', 'dee1', '18+'), ('00000000-0000-0000-0000-0000000000d2', 'dee2', '18+'), ('00000000-0000-0000-0000-0000000000d3', 'dee3', '18+');

-- Streak grows on consecutive days, only once per day
select is((select streak from public.svc_record_daily_clear('00000000-0000-0000-0000-0000000000d1', 'crownfall', '2026-11-01', 60000, null, 0, 0)), 1, 'first clear starts a streak');
select is((select extended from public.svc_record_daily_clear('00000000-0000-0000-0000-0000000000d1', 'dusk', '2026-11-01', 60000, null, 0, 0)), false, 'second clear the same day does not extend');
select is((select streak from public.svc_record_daily_clear('00000000-0000-0000-0000-0000000000d1', 'crownfall', '2026-11-02', 50000, null, 0, 0)), 2, 'next day extends');

-- Freeze covers one missed day; without one the streak is lost
update public.streaks set current = 7, freezes_held = 1, last_clear_date = '2026-11-02' where player_id = '00000000-0000-0000-0000-0000000000d1';
insert into public.streaks (player_id, current, last_clear_date) values ('00000000-0000-0000-0000-0000000000d2', 5, '2026-11-02');
select public.svc_daily_rollover('2026-11-04');
select is((select current from public.streaks where player_id = '00000000-0000-0000-0000-0000000000d1'), 7, 'a held Freeze protects the streak');
select is((select freezes_held from public.streaks where player_id = '00000000-0000-0000-0000-0000000000d1')::int, 0, 'the Freeze is consumed');
select is((select current from public.streaks where player_id = '00000000-0000-0000-0000-0000000000d2'), 0, 'no Freeze, streak lost');
select is((select lost_value from public.streaks where player_id = '00000000-0000-0000-0000-0000000000d2'), 5, 'lost value kept for Streak Repair');

-- Ranking: faster first, then fewer hints
insert into public.daily_results (date, game_id, player_id, time_ms, hints, mistakes, finished_at) values
  ('2026-11-05', 'crownfall', '00000000-0000-0000-0000-0000000000d2', 40000, 1, 0, now()),
  ('2026-11-05', 'crownfall', '00000000-0000-0000-0000-0000000000d3', 40000, 0, 0, now());
select public.svc_daily_rollover('2026-11-06');
select is((select rank_global from public.daily_results where date = '2026-11-05' and player_id = '00000000-0000-0000-0000-0000000000d3'), 1, 'ties broken by fewer hints');
select ok((select detail ? 'missing_dailies' from public.audit_log where action = 'cron.daily_rollover' order by id desc limit 1), 'rollover is audited');
select * from finish();
rollback;
