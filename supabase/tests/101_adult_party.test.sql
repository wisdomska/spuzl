begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Server-only tables: forced RLS, no client privileges, no policies
select ok((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class
  where oid in ('public.party_rounds'::regclass, 'public.party_guesses'::regclass, 'public.party_votes'::regclass)), 'party tables have RLS enabled and forced');
select ok(not has_table_privilege('authenticated', 'public.party_rounds', 'select')
  and not has_table_privilege('authenticated', 'public.party_guesses', 'select')
  and not has_table_privilege('authenticated', 'public.party_votes', 'select')
  and not has_table_privilege('anon', 'public.party_rounds', 'select'), 'clients cannot read party rounds, guesses or votes');
select ok(not has_table_privilege('authenticated', 'public.party_guesses', 'insert')
  and not has_table_privilege('authenticated', 'public.party_votes', 'insert'), 'clients cannot write guesses or votes');
select is((select count(*)::int from pg_policies where tablename in ('party_rounds', 'party_guesses', 'party_votes')), 0, 'no client policies on party tables');
select ok(not has_function_privilege('authenticated', 'public.svc_party_strokes(uuid, smallint, smallint, uuid, text, jsonb, integer, integer)', 'execute'), 'clients cannot draw directly');
select ok(has_function_privilege('service_role', 'public.svc_party_strokes(uuid, smallint, smallint, uuid, text, jsonb, integer, integer)', 'execute'), 'the server can');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001a1', 'apa@test'), ('00000000-0000-0000-0000-0000000001b1', 'apb@test');
insert into public.players (id, nickname, age_band, is_guest) values
  ('00000000-0000-0000-0000-0000000001a1', 'ap_alice', '18+', false), ('00000000-0000-0000-0000-0000000001b1', 'ap_bobby', '18+', false);

-- An adult room is a plain party room: no classroom, no puzzle game
select throws_ok($$insert into public.matches (kind, party_mode, classroom) values ('race', 'draw', true)$$, '23514', null, 'an adult room cannot be a classroom');
select throws_ok($$insert into public.matches (kind, party_mode) values ('duel', 'truths')$$, '23514', null, 'an adult mode is never a duel');
select throws_ok($$insert into public.matches (kind, party_mode) values ('race', 'poker')$$, '23514', null, 'unknown modes are refused');

insert into public.matches (id, kind, status, party_mode, party_leads) values
  ('00000000-0000-0000-0000-00000000ad01', 'race', 'playing', 'draw', '{00000000-0000-0000-0000-0000000001a1,00000000-0000-0000-0000-0000000001b1}');
insert into public.match_players (match_id, player_id, seat) values
  ('00000000-0000-0000-0000-00000000ad01', '00000000-0000-0000-0000-0000000001a1', 0),
  ('00000000-0000-0000-0000-00000000ad01', '00000000-0000-0000-0000-0000000001b1', 1);
insert into public.party_rounds (match_id, set_no, round, mode, lead_id, word, phase, started_at, phase_ends_at) values
  ('00000000-0000-0000-0000-00000000ad01', 1, 1, 'draw', '00000000-0000-0000-0000-0000000001a1', 'banku', 'play', now(), now() + interval '80 seconds');

-- Strokes: only the drawer, only within the caps
select is(public.svc_party_strokes('00000000-0000-0000-0000-00000000ad01', 1::smallint, 1::smallint, '00000000-0000-0000-0000-0000000001a1', 'add',
  '[{"c":0,"w":1,"p":[1,2,3,4]},{"c":1,"w":0,"p":[5,6,7,8]}]'::jsonb, 400, 12000), 2, 'the drawer adds strokes');
select is(public.svc_party_strokes('00000000-0000-0000-0000-00000000ad01', 1::smallint, 1::smallint, '00000000-0000-0000-0000-0000000001b1', 'add',
  '[{"c":0,"w":1,"p":[1,2,3,4]}]'::jsonb, 400, 12000), null, 'a guesser cannot draw');
select is(public.svc_party_strokes('00000000-0000-0000-0000-00000000ad01', 1::smallint, 1::smallint, '00000000-0000-0000-0000-0000000001a1', 'add',
  '[{"c":0,"w":1,"p":[1,2,3,4]}]'::jsonb, 2, 12000), null, 'the stroke cap holds');
select is(public.svc_party_strokes('00000000-0000-0000-0000-00000000ad01', 1::smallint, 1::smallint, '00000000-0000-0000-0000-0000000001a1', 'add',
  '[{"c":0,"w":1,"p":[1,2,3,4]}]'::jsonb, 400, 4), null, 'the point cap holds');
select is(public.svc_party_strokes('00000000-0000-0000-0000-00000000ad01', 1::smallint, 1::smallint, '00000000-0000-0000-0000-0000000001a1', 'undo', null, 400, 12000), 1, 'undo drops the last stroke');
update public.party_rounds set phase = 'reveal' where match_id = '00000000-0000-0000-0000-00000000ad01';
select is(public.svc_party_strokes('00000000-0000-0000-0000-00000000ad01', 1::smallint, 1::smallint, '00000000-0000-0000-0000-0000000001a1', 'clear', null, 400, 12000), null, 'no drawing once the round closes');

-- One correct guess per player per round; free text is length-capped
insert into public.party_guesses (match_id, set_no, round, player_id, correct, elapsed_ms) values
  ('00000000-0000-0000-0000-00000000ad01', 1, 1, '00000000-0000-0000-0000-0000000001b1', true, 1200);
select throws_ok($$insert into public.party_guesses (match_id, set_no, round, player_id, correct, elapsed_ms) values
  ('00000000-0000-0000-0000-00000000ad01', 1, 1, '00000000-0000-0000-0000-0000000001b1', true, 1300)$$, '23505', null, 'a player scores once per round');
select throws_ok($$insert into public.party_guesses (match_id, set_no, round, player_id, text, elapsed_ms) values
  ('00000000-0000-0000-0000-00000000ad01', 1, 1, '00000000-0000-0000-0000-0000000001b1', repeat('x', 31), 1)$$, '23514', null, 'guesses are 30 characters max');

-- Party-content reports carry a snapshot; the room's live state goes with the room
insert into public.reports (reporter_id, target_type, target_id, reason, snapshot) values
  ('00000000-0000-0000-0000-0000000001b1', 'party', '00000000-0000-0000-0000-0000000001a1', 'harassment', '{"kind":"drawing","strokes":[]}');
delete from public.matches where id = '00000000-0000-0000-0000-00000000ad01';
select is((select count(*)::int from public.party_rounds where match_id = '00000000-0000-0000-0000-00000000ad01')
  + (select count(*)::int from public.party_guesses where match_id = '00000000-0000-0000-0000-00000000ad01'), 0, 'rounds and guesses are deleted with the room');
select is((select count(*)::int from public.reports where target_type = 'party' and target_id = '00000000-0000-0000-0000-0000000001a1' and snapshot ? 'kind'), 1,
  'the report and its snapshot outlive the room');

select * from finish();
rollback;
