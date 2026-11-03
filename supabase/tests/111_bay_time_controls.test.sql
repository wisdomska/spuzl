begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select has_column('public', 'board_matches', 'clock_base_ms', 'matches keep their time control');
select has_column('public', 'board_queue', 'clock_ms', 'queue entries carry the time control asked for');
select is(
  has_function_privilege('authenticated', 'public.svc_bay_mm_claim_timed(uuid[], text, integer, uuid)', 'execute'),
  false,
  'players cannot claim queue entries'
);

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000111', 'tc1@test.local'),
  ('20000000-0000-4000-8000-000000000111', 'tc2@test.local'),
  ('30000000-0000-4000-8000-000000000111', 'tc3@test.local');
insert into public.players (id, nickname, age_band) values
  ('10000000-0000-4000-8000-000000000111', 'tc_one_111', '18+'),
  ('20000000-0000-4000-8000-000000000111', 'tc_two_111', '18+'),
  ('30000000-0000-4000-8000-000000000111', 'tc_three_111', '18+');
insert into public.board_matches (id, game_id, mode, status, players, state, clock_base_ms) values
  ('40000000-0000-4000-8000-000000000111', 'chess', 'live', 'waiting',
   array['10000000-0000-4000-8000-000000000111', '20000000-0000-4000-8000-000000000111']::uuid[], '{}'::jsonb, 600000);
-- One and two want 10 minutes, three wants 3.
insert into public.board_queue (player_id, game_id, clock_ms) values
  ('10000000-0000-4000-8000-000000000111', 'chess', 600000),
  ('20000000-0000-4000-8000-000000000111', 'chess', 600000),
  ('30000000-0000-4000-8000-000000000111', 'chess', 180000);

select is(
  public.svc_bay_mm_claim_timed(array['10000000-0000-4000-8000-000000000111', '30000000-0000-4000-8000-000000000111']::uuid[],
    'chess', 600000, '40000000-0000-4000-8000-000000000111'),
  false,
  'players who picked different time controls are not paired'
);
select is(
  public.svc_bay_mm_claim_timed(array['10000000-0000-4000-8000-000000000111', '20000000-0000-4000-8000-000000000111']::uuid[],
    'chess', 600000, '40000000-0000-4000-8000-000000000111'),
  true,
  'players who picked the same time control are paired'
);
select is(
  (select count(*)::int from public.board_queue where match_id = '40000000-0000-4000-8000-000000000111'),
  2,
  'both entries are claimed'
);
select throws_ok(
  $$insert into public.board_queue (player_id, game_id, clock_ms) values ('10000000-0000-4000-8000-000000000111', 'chess', 1000)
    on conflict (player_id) do update set clock_ms = 1000$$,
  '23514',
  null,
  'an impossible time control is refused'
);

select * from finish();
rollback;
