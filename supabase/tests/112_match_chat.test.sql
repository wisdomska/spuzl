begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_table('public', 'match_messages', 'match chat table exists');
select is((select relforcerowsecurity from pg_class where oid = 'public.match_messages'::regclass), true, 'RLS is forced');
select is(has_table_privilege('authenticated', 'public.match_messages', 'select'), false, 'players cannot read chat directly');
select is(has_table_privilege('anon', 'public.match_messages', 'insert'), false, 'nobody writes chat directly');
select is(
  has_function_privilege('authenticated', 'public.svc_prune_match_messages()', 'execute'),
  false,
  'players cannot prune chat'
);

select * from finish();
rollback;
