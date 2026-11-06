begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- R2-13: room_join_requests (20261130101301). Server-only table: forced RLS, no client grants, one pending
-- request per player per room, and a decided time exactly when the request is decided.

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.room_join_requests'::regclass),
  'RLS is enabled and forced');
select ok(not has_table_privilege('authenticated', 'public.room_join_requests', 'select')
  and not has_table_privilege('anon', 'public.room_join_requests', 'select')
  and not has_table_privilege('authenticated', 'public.room_join_requests', 'insert'),
  'clients can neither read nor write it (the host reads through the API)');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a131', 'jr-host@test.local'),
  ('00000000-0000-0000-0000-00000000a132', 'jr-asker@test.local');
insert into public.players (id, nickname, age_band) values
  ('00000000-0000-0000-0000-00000000a131', 'jrhost', '13-15'),
  ('00000000-0000-0000-0000-00000000a132', 'jrasker', '18+');
insert into public.matches (id, kind, status, host_id, code) values
  ('00000000-0000-0000-0000-00000000b131', 'race', 'lobby', '00000000-0000-0000-0000-00000000a131', 'QJRA');

insert into public.room_join_requests (match_id, room_kind, room_code, host_id, requester_id) values
  ('00000000-0000-0000-0000-00000000b131', 'party', 'QJRA', '00000000-0000-0000-0000-00000000a131', '00000000-0000-0000-0000-00000000a132');

select throws_ok($$insert into public.room_join_requests (match_id, room_kind, room_code, host_id, requester_id) values
  ('00000000-0000-0000-0000-00000000b131', 'party', 'QJRA', '00000000-0000-0000-0000-00000000a131', '00000000-0000-0000-0000-00000000a132')$$,
  '23505', null, 'one pending request per player per room');

select throws_ok($$update public.room_join_requests set status = 'approved' where room_code = 'QJRA'$$, '23514', null,
  'a decided request needs its decided time');

update public.room_join_requests set status = 'declined', decided_at = now() where room_code = 'QJRA';
select lives_ok($$insert into public.room_join_requests (match_id, room_kind, room_code, host_id, requester_id) values
  ('00000000-0000-0000-0000-00000000b131', 'party', 'QJRA', '00000000-0000-0000-0000-00000000a131', '00000000-0000-0000-0000-00000000a132')$$,
  'the log keeps decided rows next to a new pending one');

delete from public.matches where id = '00000000-0000-0000-0000-00000000b131';
select is((select count(*)::int from public.room_join_requests where room_code = 'QJRA' and match_id is null), 2,
  'the log outlives the room');

select * from finish();
rollback;
