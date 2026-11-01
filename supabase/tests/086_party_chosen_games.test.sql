begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Party rooms keep the host's hand-picked games apart from matches.games (the per-round list).
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000086a1', 'host@chosen.test');
insert into public.players (id, nickname, age_band) values ('00000000-0000-0000-0000-0000000086a1', 'chosen_host', '18+');
insert into public.matches (id, kind, status, host_id, mix, chosen_games)
  values ('86868686-0000-0000-0000-000000000001', 'race', 'lobby', '00000000-0000-0000-0000-0000000086a1', true,
          array['crownfall', 'sixer', 'quilt']);

select is((select chosen_games from public.matches where id = '86868686-0000-0000-0000-000000000001'),
  array['crownfall', 'sixer', 'quilt'], 'a room stores the host''s picks');
select is((select games from public.matches where id = '86868686-0000-0000-0000-000000000001'), '{}'::text[],
  'apart from the per-round games');
update public.matches set games = array['sixer', 'quilt', 'crownfall'], status = 'playing'
  where id = '86868686-0000-0000-0000-000000000001';
select is((select chosen_games from public.matches where id = '86868686-0000-0000-0000-000000000001'),
  array['crownfall', 'sixer', 'quilt'], 'starting the race leaves the picks for the next set');
select throws_ok($$ update public.matches set chosen_games = array['a','b','c','d','e','f','g','h','i']
                    where id = '86868686-0000-0000-0000-000000000001' $$, '23514', null, 'at most 8 picks');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000086a1", "role": "authenticated"}';
select throws_ok($$ update public.matches set chosen_games = '{}' where id = '86868686-0000-0000-0000-000000000001' $$,
  '42501', null, 'players cannot change the picks directly, even the host');
reset role;
select ok((select relforcerowsecurity from pg_class where oid = 'public.matches'::regclass), 'RLS is forced on matches');

select * from finish();
rollback;
