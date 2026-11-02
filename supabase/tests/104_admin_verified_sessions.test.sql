begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_table('public', 'admin_verified_sessions', 'verified admin sessions table exists');
select is((select relforcerowsecurity from pg_class where oid = 'public.admin_verified_sessions'::regclass), true, 'RLS is forced');
select is(has_table_privilege('authenticated', 'public.admin_verified_sessions', 'select'), false, 'players cannot read it');
select is(has_table_privilege('anon', 'public.admin_verified_sessions', 'insert'), false, 'anonymous cannot write it');

select * from finish();
rollback;
