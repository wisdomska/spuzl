begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

-- 20261216010101: an admin who approved a question can delete their account; the question keeps naming them.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000028001', 'author280@admin.test'),
  ('00000000-0000-0000-0000-000000028002', 'reviewer280@admin.test');
insert into public.content_items (id, game_id, payload, author_id, reviewer_id, status)
select '00000000-0000-0000-0000-000000028101', g.id, '{"q":"test"}'::jsonb,
  '00000000-0000-0000-0000-000000028001', '00000000-0000-0000-0000-000000028002', 'approved'
from public.games g order by g.id limit 1;

select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-000000028002'$$,
  'the reviewer of an approved question can delete their account');
select is((select reviewer_id from public.content_items where id = '00000000-0000-0000-0000-000000028101'),
  '00000000-0000-0000-0000-000000028002'::uuid, 'the approved question still names who approved it');
select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-000000028001'$$,
  'and so can its author');

select * from finish();
rollback;
