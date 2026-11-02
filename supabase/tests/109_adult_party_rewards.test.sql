begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- XP and Sparks for the 18+ party games: party_rounds.played (server only, forced RLS kept) and
-- svc_grant_capped_reward (idempotent per ref, clamped to a daily cap per source, service role only).

select has_column('public', 'party_rounds', 'played', 'party_rounds.played exists');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.party_rounds'::regclass),
  'party_rounds still has forced RLS');
select ok(not has_table_privilege('authenticated', 'public.party_rounds', 'select'), 'clients still cannot read party rounds');
select ok(not has_function_privilege('authenticated', 'public.svc_grant_capped_reward(uuid, text, text, integer, integer, integer)', 'execute')
  and not has_function_privilege('anon', 'public.svc_grant_capped_reward(uuid, text, text, integer, integer, integer)', 'execute'),
  'clients cannot grant rewards');
select ok(has_function_privilege('service_role', 'public.svc_grant_capped_reward(uuid, text, text, integer, integer, integer)', 'execute'),
  'the server can');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002a1', 'apr_a@test'), ('00000000-0000-0000-0000-0000000002b1', 'apr_b@test');
insert into public.players (id, nickname, age_band, is_guest) values
  ('00000000-0000-0000-0000-0000000002a1', 'apr_alice', '18+', false), ('00000000-0000-0000-0000-0000000002b1', 'apr_bobby', '18+', false);

-- played: at most 8 players, empty by default
insert into public.matches (id, kind, status, party_mode) values ('00000000-0000-0000-0000-00000000ae01', 'race', 'playing', 'draw');
insert into public.party_rounds (match_id, set_no, round, mode, phase, started_at, phase_ends_at) values
  ('00000000-0000-0000-0000-00000000ae01', 1, 1, 'draw', 'play', now(), now() + interval '80 seconds');
select is((select played from public.party_rounds where match_id = '00000000-0000-0000-0000-00000000ae01'), '{}'::uuid[],
  'played starts empty');
select throws_ok(
  $$ update public.party_rounds set played = array_fill('00000000-0000-0000-0000-0000000002a1'::uuid, array[9])
     where match_id = '00000000-0000-0000-0000-00000000ae01' $$,
  '23514', null, 'played holds at most 8 players');

-- A grant under the cap pays in full, once per ref
select is((select xp_added from public.svc_grant_capped_reward('00000000-0000-0000-0000-0000000002a1', 'party_adult', 'room1:1', 40, 6, 100)),
  40, 'under the cap: full XP');
select is((select sum(amount) from public.sparks_ledger where player_id = '00000000-0000-0000-0000-0000000002a1' and source = 'party_adult'), 6::bigint, 'and the Sparks');
select is((select xp_added + sparks_added from public.svc_grant_capped_reward('00000000-0000-0000-0000-0000000002a1', 'party_adult', 'room1:1', 40, 6, 100)),
  0, 'the same ref never pays twice');

-- The cap clamps XP; Sparks pay while under it
select is((select xp_added from public.svc_grant_capped_reward('00000000-0000-0000-0000-0000000002a1', 'party_adult', 'room2:1', 80, 6, 100)),
  60, 'XP is clamped to what is left of the daily cap');
select is((select sum(amount) from public.sparks_ledger where player_id = '00000000-0000-0000-0000-0000000002a1' and source = 'party_adult'), 12::bigint,
  'Sparks still pay on the grant that reaches the cap');
select is((select xp_added + sparks_added from public.svc_grant_capped_reward('00000000-0000-0000-0000-0000000002a1', 'party_adult', 'room3:1', 20, 6, 100)),
  0, 'at the cap: no XP and no Sparks');
select is((select amount from public.xp_ledger where player_id = '00000000-0000-0000-0000-0000000002a1' and source = 'party_adult' and ref_id = 'room3:1'),
  0, 'a capped grant still marks its ref as paid');
select is((select xp_added from public.svc_grant_capped_reward('00000000-0000-0000-0000-0000000002a1', 'party_adult', 'room3:1', 20, 6, 1000)),
  0, 'so it never pays later, even with room under a higher cap');

-- The cap counts this source only, and yesterday's XP doesn't count
select is((select xp_added from public.svc_grant_capped_reward('00000000-0000-0000-0000-0000000002a1', 'party', 'race1:1', 30, 0, 100)),
  30, 'other sources have their own cap');
insert into public.xp_ledger (player_id, source, ref_id, amount, created_at)
  values ('00000000-0000-0000-0000-0000000002b1', 'party_adult', 'old:1', 500, now() - interval '1 day');
select is((select xp_added from public.svc_grant_capped_reward('00000000-0000-0000-0000-0000000002b1', 'party_adult', 'room1:1', 40, 6, 100)),
  40, 'the cap is per GMT day');

select throws_ok(
  $$ select * from public.svc_grant_capped_reward('00000000-0000-0000-0000-0000000009ff', 'party_adult', 'x', 1, 1, 100) $$,
  'P0001', 'unknown player', 'unknown players are refused');

select * from finish();
rollback;
