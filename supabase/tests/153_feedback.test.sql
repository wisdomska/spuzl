begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- R4-02 (20261209000201): feedback from /contact lives in public.feedback, server only.
select has_table('public', 'feedback', 'feedback table');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.feedback'::regclass),
  'RLS is enabled and forced');
select ok(not has_table_privilege('anon', 'public.feedback', 'select, insert, update, delete'), 'anon has no privileges');
select ok(not has_table_privilege('authenticated', 'public.feedback', 'select, insert, update, delete'),
  'authenticated has no privileges');
select has_index('public', 'feedback', 'feedback_status_created_idx', 'index on status and newest first');
select fk_ok('public', 'feedback', 'player_id', 'public', 'players', 'id');
select is((select confdeltype::text from pg_constraint where conrelid = 'public.feedback'::regclass and contype = 'f'
           and conkey = array[(select attnum from pg_attribute where attrelid = 'public.feedback'::regclass and attname = 'player_id')]),
  'c', 'a player''s feedback is deleted with the account (on delete cascade)');

select lives_ok($$insert into public.feedback (message, kind, from_path) values ('The timer froze on level 3.', 'bug', '/games/crownfall')$$,
  'a signed-out message with a path is stored');
select throws_ok($$insert into public.feedback (message) values ('too short')$$, '23514', null, 'messages need 10 characters');
select throws_ok($$insert into public.feedback (message, kind) values ('A perfectly fine message.', 'rant')$$, '23514', null,
  'only known kinds');
select throws_ok($$insert into public.feedback (message, from_path) values ('A perfectly fine message.', '//evil.example')$$, '23514', null,
  'from_path is a same-site path');

set local role authenticated;
select throws_ok($$select count(*) from public.feedback$$, '42501', null, 'players cannot read feedback');
reset role;

select * from finish();
rollback;
