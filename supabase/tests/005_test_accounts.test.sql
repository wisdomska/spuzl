begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 't' || i || '@test' from generate_series(1, 6) i;
insert into public.players (id, nickname, age_band, is_test)
  select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'stage' || i, '18+', i = 6 from generate_series(1, 6) i;
-- five real players at 100 s, one staging player at 1 s
insert into public.daily_results (date, game_id, player_id, time_ms, finished_at)
  select '2026-11-10', 'crownfall', ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, case when i = 6 then 1000 else 100000 end, now() from generate_series(1, 6) i;

select is((select count(*)::int from public.player_cards where nickname like 'stage%'), 5, 'staging players are hidden from public cards');
select is(private.daily_median('crownfall', '2026-11-10'), 100000, 'staging times do not move the median');
select public.svc_daily_rollover('2026-11-11');
select is((select rank_global from public.daily_results where player_id = '00000000-0000-0000-0000-000000000106'), null, 'staging players are never ranked');
set local role anon;
select is((select count(*)::int from public.daily_results where date = '2026-11-10'), 5, 'public boards hide staging results');
reset role;
select * from finish();
rollback;
