-- R3-06 (20261207000601): Quick Match pools. svc_mm_claim pairs only players in one age-band pool.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select has_column('public', 'matchmaking_queue', 'pool', 'queue rows carry a pool');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.matchmaking_queue'::regclass), 'matchmaking_queue keeps RLS forced');
select ok(not has_function_privilege('authenticated', 'public.svc_mm_claim(uuid[], uuid)', 'execute'), 'clients cannot claim pairs');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006a1', 'qma@test'), ('00000000-0000-0000-0000-0000000006b1', 'qmb@test'),
  ('00000000-0000-0000-0000-0000000006c1', 'qmc@test');
insert into public.players (id, nickname, age_band) values
  ('00000000-0000-0000-0000-0000000006a1', 'qm_adult', '18+'), ('00000000-0000-0000-0000-0000000006b1', 'qm_kid', '13-15'),
  ('00000000-0000-0000-0000-0000000006c1', 'qm_kid2', '13-15');
insert into public.matches (id, kind, status, games) values
  ('00000000-0000-0000-0000-00000000a601', 'duel', 'queue', '{crownfall,crownfall,crownfall}'),
  ('00000000-0000-0000-0000-00000000a602', 'duel', 'queue', '{crownfall,crownfall,crownfall}');
insert into public.matchmaking_queue (player_id, game_id, rating, pool) values
  ('00000000-0000-0000-0000-0000000006a1', null, 1000, 'open'),
  ('00000000-0000-0000-0000-0000000006b1', null, 1000, 'u16'),
  ('00000000-0000-0000-0000-0000000006c1', null, 1000, 'u16');

select throws_ok($$insert into public.matchmaking_queue (player_id, game_id, rating, pool)
  values ('00000000-0000-0000-0000-0000000006a1', null, 1000, 'kids') on conflict (player_id) do update set pool = excluded.pool$$,
  '23514', null, 'only the two pools exist');

select ok(not public.svc_mm_claim(array['00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006b1']::uuid[],
  '00000000-0000-0000-0000-00000000a601'), 'an adult and a 13-15 player are never claimed as a pair');
select is((select count(*)::int from public.matchmaking_queue where match_id is not null), 0, 'a refused claim changes nothing');
select ok(public.svc_mm_claim(array['00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006c1']::uuid[],
  '00000000-0000-0000-0000-00000000a602'), 'two 13-15 players are claimed as a pair');

select * from finish();
rollback;
