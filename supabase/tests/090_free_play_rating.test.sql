begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- World ranks from free play: a clear is scored against the last 30 days of other free-play clears of the same
-- game and difficulty; under 10 such clears there is no field (null).
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000009a0', 'f@freerating.test');
insert into public.players (id, nickname, age_band) values ('00000000-0000-0000-0000-0000000009a0', 'free_rating', '18+');

select is(public.svc_free_percentile('crownfall', 'medium', 55000, gen_random_uuid()), null::numeric,
  'no field yet: no percentile');

-- 12 clears at 10 s, 20 s, ... 120 s on medium, one relaxed and one old clear that must not count.
insert into public.attempts (player_id, game_id, mode, free_seed, status, finished_at, time_ms)
  select '00000000-0000-0000-0000-0000000009a0', 'crownfall', 'free', 'frt' || i || '|medium', 'cleared', now(), i * 10000
  from generate_series(1, 12) i;
insert into public.attempts (player_id, game_id, mode, free_seed, status, finished_at, time_ms, relaxed) values
  ('00000000-0000-0000-0000-0000000009a0', 'crownfall', 'free', 'frt-relaxed|medium', 'cleared', now(), 999000, true),
  ('00000000-0000-0000-0000-0000000009a0', 'crownfall', 'free', 'frt-old|medium', 'cleared', now() - interval '40 days', 999000, false);

-- Other test data may add crownfall medium clears, so check against the field this test can see.
select is(public.svc_free_percentile('crownfall', 'medium', 1, gen_random_uuid()), 100::numeric,
  'faster than every clear in the field: 100');
select ok(public.svc_free_percentile('crownfall', 'medium', 55000, gen_random_uuid()) between 1 and 99,
  'a middling time lands inside the field');
select is(public.svc_free_percentile('crownfall', 'hard', 55000, gen_random_uuid()), null::numeric,
  'other difficulties are a different field');

select throws_ok(
  $$ set local role authenticated; select public.svc_free_percentile('crownfall', 'medium', 1, gen_random_uuid()) $$,
  '42501', null, 'players cannot call the service function');

select * from finish();
rollback;
