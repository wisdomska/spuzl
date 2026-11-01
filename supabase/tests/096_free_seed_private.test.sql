begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Free play's seed rebuilds the board's solution, so players can't read it, even on their own attempts.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000009b0', 'f@freeseed.test');
insert into public.players (id, nickname, age_band) values ('00000000-0000-0000-0000-0000000009b0', 'free_seed', '18+');
insert into public.attempts (player_id, game_id, mode, free_seed)
  values ('00000000-0000-0000-0000-0000000009b0', 'crownfall', 'free', 'free:crownfall:secret|easy');

select ok(not has_column_privilege('authenticated', 'public.attempts', 'free_seed', 'select'), 'players cannot select free_seed');
select ok(not has_table_privilege('anon', 'public.attempts', 'select'), 'anon cannot select attempts');
select ok(has_column_privilege('service_role', 'public.attempts', 'free_seed', 'select'), 'the server still reads free_seed');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000009b0", "role": "authenticated"}';
select is((select count(*)::int from public.attempts where mode = 'free'), 1, 'a player still sees their own attempt');
select throws_ok($$ select free_seed from public.attempts $$, '42501', null, 'reading free_seed is refused');
select throws_ok($$ select * from public.attempts $$, '42501', null, 'select * is refused too (it includes free_seed)');
reset role;

select * from finish();
rollback;
