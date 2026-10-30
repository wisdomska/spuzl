begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Every public table has RLS enabled and forced
select is(
  (select count(*)::int from pg_tables t join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
   where t.schemaname = 'public' and not (c.relrowsecurity and c.relforcerowsecurity)),
  0, 'every public table has RLS enabled and forced');

-- Clients cannot write any table directly
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  0, 'anon and authenticated have no write grants');

-- Service functions are not executable by clients
select ok(not has_function_privilege('authenticated', 'public.svc_grant_reward(uuid, text, text, integer, integer)', 'execute'), 'authenticated cannot grant rewards');
select ok(not has_function_privilege('anon', 'public.svc_daily_rollover(date)', 'execute'), 'anon cannot run rollover');
select ok(has_function_privilege('service_role', 'public.svc_grant_reward(uuid, text, text, integer, integer)', 'execute'), 'service role can grant rewards');

-- Two players; each sees only their own private rows
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test'), ('00000000-0000-0000-0000-00000000000b', 'b@test');
insert into public.players (id, nickname, age_band) values ('00000000-0000-0000-0000-00000000000a', 'alice', '18+'), ('00000000-0000-0000-0000-00000000000b', 'bobby', '13-15');
select public.svc_grant_reward('00000000-0000-0000-0000-00000000000a', 'test', 'x', 50, 5);
select public.svc_grant_reward('00000000-0000-0000-0000-00000000000b', 'test', 'x', 70, 7);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is((select count(*)::int from public.players), 1, 'a player sees only their own player row');
select is((select count(*)::int from public.xp_ledger), 1, 'a player sees only their own XP ledger');
select is((select count(*)::int from public.puzzles), 0, 'puzzles (with solutions) are never readable by clients');
select throws_ok($$ insert into public.xp_ledger (player_id, source, ref_id, amount) values ('00000000-0000-0000-0000-00000000000a', 'cheat', '1', 9999) $$, '42501', null, 'clients cannot insert XP');
select is((select country from public.player_cards where nickname = 'bobby'), null, 'under-16 profiles hide location on public cards');
reset role;

update public.players set banned_at = now() where nickname = 'bobby';
select is((select count(*)::int from public.player_cards where nickname in ('alice', 'bobby')), 1, 'public cards hide banned players');
select * from finish();
rollback;
