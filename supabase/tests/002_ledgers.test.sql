begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'c@test');
insert into public.players (id, nickname, age_band) values ('00000000-0000-0000-0000-0000000000c1', 'carol', '18+');

select is((select xp_added from public.svc_grant_reward('00000000-0000-0000-0000-0000000000c1', 'daily', 'crownfall:2026-11-01', 120, 25)), 120, 'reward granted');
select is((select xp_added from public.svc_grant_reward('00000000-0000-0000-0000-0000000000c1', 'daily', 'crownfall:2026-11-01', 120, 25)), 0, 'same source and ref is idempotent');
select is((select xp from public.players where id = '00000000-0000-0000-0000-0000000000c1'), 120::bigint, 'cached balance matches ledger');
select is((select level from public.players where id = '00000000-0000-0000-0000-0000000000c1'), 2, 'crossing 100 XP reaches level 2');
select is((select sparks from public.players where id = '00000000-0000-0000-0000-0000000000c1'), 45::bigint, 'level-up adds 20 Sparks on top of 25');

select throws_ok($$ update public.xp_ledger set amount = 1 $$, 'P0001', 'ledger rows are append-only', 'XP ledger cannot be updated');
select throws_ok($$ select public.svc_spend_sparks('00000000-0000-0000-0000-0000000000c1', 'shop', 'freeze', 999) $$, 'P0001', 'not enough sparks', 'cannot overspend');
select is(public.svc_spend_sparks('00000000-0000-0000-0000-0000000000c1', 'shop', 'hat', 40), 5::bigint, 'spend reduces the balance');
select * from finish();
rollback;
