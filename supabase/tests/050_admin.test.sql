begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Fixtures: an owner, an editor, a moderator, a plain player, and a flagged Daily clear.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000a0001', 'owner@test'),
  ('00000000-0000-0000-0000-0000000a0002', 'editor@test'),
  ('00000000-0000-0000-0000-0000000a0003', 'mod@test'),
  ('00000000-0000-0000-0000-0000000a0004', 'player@test'),
  ('00000000-0000-0000-0000-0000000a0005', 'tester@test');
insert into public.admins (user_id, role) values
  ('00000000-0000-0000-0000-0000000a0001', 'owner'),
  ('00000000-0000-0000-0000-0000000a0002', 'content_editor'),
  ('00000000-0000-0000-0000-0000000a0003', 'moderator');
insert into public.players (id, nickname, age_band) values ('00000000-0000-0000-0000-0000000a0004', 'flaggy', '18+');
insert into public.players (id, nickname, age_band, is_test) values ('00000000-0000-0000-0000-0000000a0005', 'stagey', '18+', true);
insert into public.puzzles (id, game_id, seed, difficulty, data, solution, solution_hash) values
  ('00000000-0000-0000-0000-0000000b0001', 'crownfall', 'admin-test-1', 'easy', '{}', '[1]', 'h1'),
  ('00000000-0000-0000-0000-0000000b0002', 'crownfall', 'admin-test-2', 'easy', '{}', '[2]', 'h2');
insert into public.dailies (date, game_id, puzzle_id, locked) values ('2030-01-07', 'crownfall', '00000000-0000-0000-0000-0000000b0001', true);
insert into public.attempts (id, player_id, game_id, mode, daily_date, status, time_ms, flag_reason, started_at)
  values ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000a0004', 'crownfall', 'daily', '2030-01-07',
          'flagged', 900, 'below human floor', now());

-- ---------- admin-only access paths: clients (admins included) never read or write admin tables ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000a0001", "role": "authenticated", "aal": "aal2"}';
select is((select count(*)::int from public.admins), 0, 'an owner session cannot read admins directly');
select is((select count(*)::int from public.audit_log), 0, 'audit_log is not client readable');
select is((select count(*)::int from public.content_items), 0, 'content_items are not client readable');
select is((select count(*)::int from public.reports), 0, 'reports are not client readable');
select is((select count(*)::int from public.dailies), 0, 'dailies are not client readable');
select throws_ok($$ insert into public.admins (user_id, role) values ('00000000-0000-0000-0000-0000000a0004', 'owner') $$,
  '42501', null, 'clients cannot grant themselves a role');
select throws_ok($$ update public.feature_flags set enabled = true $$, '42501', null, 'clients cannot toggle feature flags');
select throws_ok($$ insert into public.audit_log (action) values ('forged') $$, '42501', null, 'clients cannot forge audit rows');
select throws_ok($$ select public.svc_admin_kpis(current_date) $$, '42501', null, 'clients cannot read live-ops RPCs');
select throws_ok($$ select public.svc_admin_player_action('00000000-0000-0000-0000-0000000a0004', null, 'ban', null, null, null) $$,
  '42501', null, 'clients cannot ban players');
select throws_ok($$ select private.admin_role('00000000-0000-0000-0000-0000000a0001') $$, '42501', null, 'clients cannot probe roles');
reset role;

set local role anon;
select throws_ok($$ select public.svc_admin_swap_daily('2030-01-07', 'crownfall', '00000000-0000-0000-0000-0000000b0002', null, 'x') $$,
  '42501', null, 'anon cannot swap a Daily');
reset role;

-- Function privileges: service role only.
select ok(has_function_privilege('service_role', 'public.svc_admin_kpis(date)', 'execute'), 'service role reads KPIs');
select ok(has_function_privilege('service_role', 'public.svc_admin_resolve_flagged(uuid, text, uuid, text)', 'execute'), 'service role resolves flags');
select ok(not has_function_privilege('authenticated', 'public.svc_admin_retention(date)', 'execute'), 'authenticated cannot read retention');
select ok(not has_function_privilege('anon', 'public.svc_admin_lock_dailies(date, date, uuid)', 'execute'), 'anon cannot lock dailies');
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  0, 'still no client write grants anywhere');
select is(
  (select count(*)::int from pg_tables t join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
   where t.schemaname = 'public' and not (c.relrowsecurity and c.relforcerowsecurity)),
  0, 'every public table still has RLS enabled and forced');

-- ---------- locks and the emergency swap ----------
select throws_ok($$ update public.dailies set puzzle_id = '00000000-0000-0000-0000-0000000b0002' where date = '2030-01-07' $$,
  'P0001', null, 'a locked Daily keeps its puzzle');
select throws_ok($$ delete from public.dailies where date = '2030-01-07' $$, 'P0001', null, 'a locked Daily cannot be deleted');
select lives_ok($$ update public.dailies set published_at = now() where date = '2030-01-07' $$, 'rollover can still publish a locked Daily');
select public.svc_admin_swap_daily('2030-01-07', 'crownfall', '00000000-0000-0000-0000-0000000b0002',
  '00000000-0000-0000-0000-0000000a0002', 'broken region');
select is((select swapped_from from public.dailies where date = '2030-01-07' and game_id = 'crownfall'),
  '00000000-0000-0000-0000-0000000b0001'::uuid, 'swap keeps swapped_from');
select is((select status from public.puzzles where id = '00000000-0000-0000-0000-0000000b0001'), 'retired', 'swapped-out puzzle is retired');
select is((select count(*)::int from public.audit_log where action = 'daily.swap' and actor_id = '00000000-0000-0000-0000-0000000a0002'),
  1, 'swap writes the audit log');

-- ---------- two-person content approval ----------
select throws_ok($$ insert into public.content_items (game_id, payload, author_id, reviewer_id, status)
  values ('coil', '{}', '00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-0000000a0002', 'approved') $$,
  '23514', null, 'an author cannot approve their own item');
select throws_ok($$ insert into public.content_items (game_id, payload, author_id, status)
  values ('coil', '{}', '00000000-0000-0000-0000-0000000a0002', 'approved') $$,
  '23514', null, 'approval needs a named reviewer');
select lives_ok($$ insert into public.content_items (game_id, payload, author_id, reviewer_id, status)
  values ('coil', '{}', '00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-0000000a0001', 'approved') $$,
  'a second person can approve');

-- ---------- flagged scores and player actions ----------
select public.svc_admin_resolve_flagged('00000000-0000-0000-0000-0000000c0001', 'clear', '00000000-0000-0000-0000-0000000a0003', 'fair');
select is((select count(*)::int from public.daily_results where player_id = '00000000-0000-0000-0000-0000000a0004'), 1,
  'clearing a flagged Daily publishes it to the boards');
select throws_ok($$ select public.svc_admin_resolve_flagged('00000000-0000-0000-0000-0000000c0001', 'reject', null, null) $$,
  'P0001', null, 'a resolved attempt cannot be resolved twice');
select public.svc_admin_player_action('00000000-0000-0000-0000-0000000a0004', '00000000-0000-0000-0000-0000000a0003', 'ban_void', 7, 'bot-like', null);
select ok((select banned_at is not null and banned_until > now() + interval '6 days' from public.players where nickname = 'flaggy'),
  'a timed ban sets banned_at and banned_until');
select is((select count(*)::int from public.daily_results where player_id = '00000000-0000-0000-0000-0000000a0004'), 0, 'ban_void voids the times');
update public.players set banned_until = now() - interval '1 minute' where nickname = 'flaggy';
select private.admin_lift_bans();
select is((select banned_at from public.players where nickname = 'flaggy'), null, 'expired bans lift');

-- Live ops never count test players.
create temp table dau_before as select (public.svc_admin_kpis((now() at time zone 'utc')::date) ->> 'dau')::int as n;
insert into public.attempts (player_id, game_id, mode, status, time_ms, started_at)
  values ('00000000-0000-0000-0000-0000000a0005', 'crownfall', 'free', 'cleared', 900, now());
select is((public.svc_admin_kpis((now() at time zone 'utc')::date) ->> 'dau')::int, (select n from dau_before), 'DAU excludes staging players');
select * from finish();
rollback;
