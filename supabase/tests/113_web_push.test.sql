begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- Migration 20261128000001: push subscriptions and server secrets are server-only.
select has_table('public', 'push_subscriptions', 'push subscriptions table');
select has_table('public', 'server_secrets', 'server secrets table');
set local role authenticated;
select throws_ok($$select count(*) from public.server_secrets$$, '42501', null, 'players cannot read server secrets');
select throws_ok($$select count(*) from public.push_subscriptions$$, '42501', null, 'players cannot read push subscriptions');
reset role;

select * from finish();
rollback;
