begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Migration 20261213010101: the live-message usage estimate, server-only.
select has_table('public', 'realtime_usage', 'realtime_usage exists');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.realtime_usage'::regclass), 'RLS is on and forced');
select ok(not has_table_privilege('authenticated', 'public.realtime_usage', 'select'), 'players cannot read it');
select ok(not has_function_privilege('authenticated', 'public.svc_add_realtime_usage(date, bigint)', 'execute'), 'players cannot add to it');

select public.svc_add_realtime_usage('2003-05-10', 40);
select public.svc_add_realtime_usage('2003-05-10', 2);
select is((select messages from public.realtime_usage where day = '2003-05-10'), 42::bigint, 'adds up per day');
select public.svc_add_realtime_usage('2003-05-10', -5);
select is((select messages from public.realtime_usage where day = '2003-05-10'), 42::bigint, 'never goes down');

select * from finish();
rollback;
