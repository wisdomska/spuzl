begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_table('public', 'board_queue', 'Board Bay queue table exists');
select is((select relforcerowsecurity from pg_class where oid = 'public.board_queue'::regclass), true, 'RLS is forced');
select is(has_table_privilege('authenticated', 'public.board_queue', 'select'), false, 'players cannot read it');
select is(has_table_privilege('anon', 'public.board_queue', 'insert'), false, 'anonymous cannot write it');
select is(
  has_function_privilege('authenticated', 'public.svc_bay_mm_claim(uuid[], text, uuid)', 'execute'),
  false,
  'players cannot claim queue entries'
);

-- Three waiting players (rows other runs left are ignored: every id here is new).
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000105', 'bq1@test.local'),
  ('20000000-0000-4000-8000-000000000105', 'bq2@test.local'),
  ('30000000-0000-4000-8000-000000000105', 'bq3@test.local');
insert into public.players (id, nickname, age_band) values
  ('10000000-0000-4000-8000-000000000105', 'bq_one_105', '18+'),
  ('20000000-0000-4000-8000-000000000105', 'bq_two_105', '18+'),
  ('30000000-0000-4000-8000-000000000105', 'bq_three_105', '16-17');
insert into public.board_matches (id, game_id, mode, status, players, state) values
  ('40000000-0000-4000-8000-000000000105', 'chess', 'live', 'waiting',
   array['10000000-0000-4000-8000-000000000105', '20000000-0000-4000-8000-000000000105']::uuid[], '{}'::jsonb),
  ('50000000-0000-4000-8000-000000000105', 'chess', 'live', 'waiting',
   array['10000000-0000-4000-8000-000000000105', '30000000-0000-4000-8000-000000000105']::uuid[], '{}'::jsonb);

select throws_ok(
  $$insert into public.board_queue (player_id, game_id) values ('10000000-0000-4000-8000-000000000105', 'flip')$$,
  '23514',
  null,
  'Flip is never queued'
);

insert into public.board_queue (player_id, game_id) values
  ('10000000-0000-4000-8000-000000000105', 'chess'),
  ('20000000-0000-4000-8000-000000000105', 'chess'),
  ('30000000-0000-4000-8000-000000000105', 'draughts');

select throws_ok(
  $$insert into public.board_queue (player_id, game_id) values ('10000000-0000-4000-8000-000000000105', 'oware')$$,
  '23505',
  null,
  'one queue entry per player'
);

select is(
  public.svc_bay_mm_claim(
    array['10000000-0000-4000-8000-000000000105', '30000000-0000-4000-8000-000000000105']::uuid[],
    'chess',
    '50000000-0000-4000-8000-000000000105'
  ),
  false,
  'players waiting for different games are not paired'
);

insert into public.blocks (player_id, blocked_id) values
  ('20000000-0000-4000-8000-000000000105', '10000000-0000-4000-8000-000000000105');
select is(
  public.svc_bay_mm_claim(
    array['10000000-0000-4000-8000-000000000105', '20000000-0000-4000-8000-000000000105']::uuid[],
    'chess',
    '40000000-0000-4000-8000-000000000105'
  ),
  false,
  'a block either way round stops the pairing'
);

delete from public.blocks where player_id = '20000000-0000-4000-8000-000000000105';
select is(
  public.svc_bay_mm_claim(
    array['10000000-0000-4000-8000-000000000105', '20000000-0000-4000-8000-000000000105']::uuid[],
    'chess',
    '40000000-0000-4000-8000-000000000105'
  ),
  true,
  'two waiting players of the same game are paired'
);
select is(
  (select count(*)::integer from public.board_queue where match_id = '40000000-0000-4000-8000-000000000105'),
  2,
  'both entries point at the new match, and cannot be claimed again'
);

select * from finish();
rollback;
