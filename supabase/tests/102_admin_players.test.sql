begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

-- Fixtures (test players are excluded by default, so the list is filtered to these through the nickname search
-- "zqp"): a guest, an email player, a Google player, a banned under-16 and a test account.
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000d0001', null, true),
  ('00000000-0000-0000-0000-0000000d0002', 'jane.doe@example.com', false),
  ('00000000-0000-0000-0000-0000000d0003', 'goog@gmail.com', false),
  ('00000000-0000-0000-0000-0000000d0004', null, true),
  ('00000000-0000-0000-0000-0000000d0005', 'tester@example.com', false),
  ('00000000-0000-0000-0000-0000000d0009', 'admin@example.com', false);
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('00000000-0000-0000-0000-0000000d0002', '00000000-0000-0000-0000-0000000d0002', '{"email": "jane.doe@example.com"}', 'email'),
  ('goog-1', '00000000-0000-0000-0000-0000000d0003', '{"email": "goog@gmail.com"}', 'google');
insert into public.players (id, nickname, age_band, sparks, xp, level, city, created_at, last_seen_at) values
  ('00000000-0000-0000-0000-0000000d0001', 'zqp_guest', '18+', 10, 100, 1, 'Accra', '2031-01-01', '2031-01-10'),
  ('00000000-0000-0000-0000-0000000d0002', 'zqp_email', '16-17', 500, 900, 4, 'Kumasi', '2031-01-02', '2031-01-03'),
  ('00000000-0000-0000-0000-0000000d0003', 'zqp_google', '18+', 50, 400, 2, null, '2031-01-03', null),
  ('00000000-0000-0000-0000-0000000d0004', 'zqp_kid', '13-15', 0, 0, 1, 'Tema', '2031-01-04', '2031-01-04');
insert into public.players (id, nickname, age_band, is_test) values ('00000000-0000-0000-0000-0000000d0005', 'zqp_test', '18+', true);
update public.players set banned_at = now(), banned_until = now() + interval '7 days' where id = '00000000-0000-0000-0000-0000000d0004';
insert into public.streaks (player_id, current, best) values ('00000000-0000-0000-0000-0000000d0002', 9, 12);
insert into public.reports (reporter_id, target_type, target_id, reason) values
  ('00000000-0000-0000-0000-0000000d0001', 'nickname', '00000000-0000-0000-0000-0000000d0003', 'nickname');

create function pg_temp.list(f jsonb, s text default 'joined', d text default 'desc', pii boolean default false) returns jsonb
language sql as $$ select public.svc_admin_players(jsonb_build_object('q', 'zqp') || f, s, d, 100, 0, pii) $$;
create function pg_temp.nicks(r jsonb) returns text language sql as $$
  select string_agg(x ->> 'nickname', ',' order by ord) from jsonb_array_elements(r -> 'rows') with ordinality as t(x, ord) $$;

-- ---------- account type and the default list ----------
select is(pg_temp.nicks(pg_temp.list('{}')), 'zqp_kid,zqp_google,zqp_email,zqp_guest', 'newest first, test accounts left out');
select is((pg_temp.list('{}') ->> 'total')::int, 4, 'total counts every match');
select is(pg_temp.nicks(pg_temp.list('{"account": "guest"}')), 'zqp_kid,zqp_guest', 'anonymous users are guests');
select is(pg_temp.nicks(pg_temp.list('{"account": "email"}')), 'zqp_email', 'an email identity is an email account');
select is(pg_temp.nicks(pg_temp.list('{"account": "google"}')), 'zqp_google', 'a Google identity is a Google account');
select is(pg_temp.nicks(pg_temp.list('{"test": "only"}')), 'zqp_test', 'test accounts on request');
select is((pg_temp.list('{"test": "include"}') ->> 'total')::int, 5, 'or included');

-- ---------- filters ----------
select is(pg_temp.nicks(pg_temp.list('{"age": "13-15"}')), 'zqp_kid', 'age band');
select is(pg_temp.nicks(pg_temp.list('{"status": "banned"}')), 'zqp_kid', 'banned');
select is(pg_temp.nicks(pg_temp.list('{"status": "active"}', 'nickname', 'asc')), 'zqp_email,zqp_google,zqp_guest', 'active');
select is(pg_temp.nicks(pg_temp.list('{"reports": "open"}')), 'zqp_google', 'open reports received');
select is(pg_temp.nicks(pg_temp.list('{"reports": "none"}', 'nickname', 'asc')), 'zqp_email,zqp_guest,zqp_kid', 'no reports');
select is(pg_temp.nicks(pg_temp.list('{"joined_from": "2031-01-02", "joined_to": "2031-01-03"}')), 'zqp_google,zqp_email',
  'joined date range, both ends inclusive');
select is(pg_temp.nicks(pg_temp.list('{"active_from": "2031-01-04"}')), 'zqp_kid,zqp_guest', 'last-active range skips never-seen players');
select is(pg_temp.nicks(public.svc_admin_players('{"q": "JANE.DOE@example.com", "q_kind": "email"}', 'joined', 'desc', 10, 0, false)),
  'zqp_email', 'exact email search, any case');
select is((public.svc_admin_players('{"q": "jane", "q_kind": "email"}', 'joined', 'desc', 10, 0, false) ->> 'total')::int, 0,
  'email search is exact, never partial');
select is(pg_temp.nicks(public.svc_admin_players('{"q": "00000000-0000-0000-0000-0000000d0003", "q_kind": "id"}', 'joined', 'desc', 10, 0, false)),
  'zqp_google', 'player id search');
select is((public.svc_admin_players('{"q": "zqp\\_%"}', 'joined', 'desc', 10, 0, false) ->> 'total')::int, 0,
  'LIKE wildcards in a nickname search are literal');

-- ---------- sorting and paging ----------
select is(pg_temp.nicks(pg_temp.list('{}', 'sparks', 'desc')), 'zqp_email,zqp_google,zqp_guest,zqp_kid', 'sparks, most first');
select is(pg_temp.nicks(pg_temp.list('{}', 'streak', 'desc')) like 'zqp_email,%', true, 'streak');
select is(pg_temp.nicks(pg_temp.list('{}', 'last_active', 'desc')), 'zqp_guest,zqp_kid,zqp_email,zqp_google', 'never seen sorts last');
select is(pg_temp.nicks(pg_temp.list('{}', 'account', 'asc')) like 'zqp_email,zqp_google,%', true, 'account type');
select is(pg_temp.nicks(public.svc_admin_players('{"q": "zqp"}', 'nickname', 'asc', 2, 2, false)), 'zqp_guest,zqp_kid', 'limit and offset');
select is((public.svc_admin_players('{"q": "zqp"}', 'nickname', 'asc', 2, 40, false) ->> 'total')::int, 4,
  'a page past the end still reports the total');
select throws_ok($$ select public.svc_admin_players('{}', 'email', 'asc', 10, 0, false) $$, '22023', null, 'unknown sort column is refused');
select throws_ok($$ select public.svc_admin_players('{}', 'nickname; drop table players', 'asc', 10, 0, false) $$, '22023', null,
  'injection through sort is refused');
select throws_ok($$ select public.svc_admin_players('{}', 'nickname', 'up', 10, 0, false) $$, '22023', null, 'bad direction is refused');

-- ---------- personal data ----------
select is((select x ->> 'email' from jsonb_array_elements(pg_temp.list('{"account": "email"}') -> 'rows') x), 'j•••@•••.com',
  'email masked without the personal-data permission');
select is((select x ->> 'email' from jsonb_array_elements(pg_temp.list('{"account": "email"}', 'joined', 'desc', true) -> 'rows') x),
  'jane.doe@example.com', 'full email with it');
select ok(not exists (select 1 from jsonb_array_elements(pg_temp.list('{}', 'joined', 'desc', true) -> 'rows') x
  where x ? 'city' or x ? 'country' or x ? 'school_id' or x ? 'email_raw'), 'no place, school or raw email fields in the list');

-- ---------- actions and their audit rows ----------
select is((public.svc_admin_grant_sparks('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000d0009', 250, 'support refund') ->> 'after')::int,
  260, 'grant Sparks');
select throws_ok($$ select public.svc_admin_grant_sparks('00000000-0000-0000-0000-0000000d0001', null, -1000, 'too much') $$,
  'P0001', null, 'removal cannot go below zero');

select throws_ok($$ select public.svc_admin_grant_sparks('00000000-0000-0000-0000-0000000d0001', null, 10001, 'too much') $$,
  '22023', null, 'grants are bounded to 10,000');
select throws_ok($$ select public.svc_admin_grant_sparks('00000000-0000-0000-0000-0000000d0001', null, 5, ' ') $$,
  '22023', null, 'a reason is required');
select is((select detail ->> 'amount' from public.audit_log where action = 'player.sparks'
            and target = 'player:00000000-0000-0000-0000-0000000d0001' order by id desc limit 1), '250', 'the grant is audited');
select is((select sum(amount)::int from public.sparks_ledger where player_id = '00000000-0000-0000-0000-0000000d0001' and source = 'admin'),
  250, 'and written to the ledger');

select is((public.svc_admin_grant_freeze('00000000-0000-0000-0000-0000000d0001', null, 'outage') ->> 'freezes')::int, 1,
  'grant a freeze (creates the streak row)');
select is((public.svc_admin_grant_freeze('00000000-0000-0000-0000-0000000d0001', null, 'outage') ->> 'freezes')::int, 2, 'a second');
select throws_ok($$ select public.svc_admin_grant_freeze('00000000-0000-0000-0000-0000000d0001', null, 'outage') $$,
  'P0001', 'freeze_full', 'never more than two held');

insert into auth.sessions (id, user_id) values (gen_random_uuid(), '00000000-0000-0000-0000-0000000d0002');
select is((public.svc_admin_revoke_sessions('00000000-0000-0000-0000-0000000d0002', null, 'lost phone') ->> 'sessions')::int, 1,
  'force sign-out deletes the sessions');
select is((select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-0000000d0002'), 0, 'none left');
select is((select count(*)::int from public.audit_log where action in ('player.freeze', 'player.signout')
            and target in ('player:00000000-0000-0000-0000-0000000d0001', 'player:00000000-0000-0000-0000-0000000d0002')), 3,
  'freezes and sign-outs are audited');

-- ---------- overview ----------
select ok((public.svc_admin_player_overview(current_date) -> 'by_method' ->> 'google')::int >= 1, 'overview splits sign-in methods');
select is((public.svc_admin_player_overview(current_date) ->> 'players')::int,
  (select count(*)::int from public.players where not is_test), 'overview leaves test players out');

-- ---------- service role only ----------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000d0002", "role": "authenticated"}';
select throws_ok($$ select public.svc_admin_players('{}', 'joined', 'desc', 10, 0, true) $$, '42501', null, 'players cannot list players');
select throws_ok($$ select public.svc_admin_grant_sparks('00000000-0000-0000-0000-0000000d0002', null, 100, 'free money') $$,
  '42501', null, 'players cannot grant themselves Sparks');
reset role;
select ok(not has_function_privilege('anon', 'public.svc_admin_revoke_sessions(uuid, uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.svc_admin_player_overview(date)', 'execute')
  and not has_function_privilege('authenticated', 'private.player_account_type(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.svc_admin_players(jsonb, text, text, integer, integer, boolean)', 'execute'),
  'the player functions are service-role only');

select * from finish();
rollback;
