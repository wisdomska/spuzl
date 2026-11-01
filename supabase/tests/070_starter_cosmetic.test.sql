begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- SPZ-19: the starter hat is charged the price the server passes (the shop.starterPrice game setting).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000070a', 'st_a@starter.test'),
  ('00000000-0000-0000-0000-00000000070b', 'st_b@starter.test');
insert into public.players (id, nickname, age_band, country, sparks) values
  ('00000000-0000-0000-0000-00000000070a', 'starter_a', '18+', 'GH', 120),
  ('00000000-0000-0000-0000-00000000070b', 'starter_b', '18+', 'GH', 500);

select ok((select payload ? 'starter' from public.cosmetics where id = 'hat-starter'), 'the starter hat is in the catalogue');

select is((select public.svc_buy_cosmetic('00000000-0000-0000-0000-00000000070a', 'hat-starter', 'r1', 60) ->> 'price')::int, 60,
  'the starter hat is charged the passed setting price');
select is((select sparks::int from public.players where id = '00000000-0000-0000-0000-00000000070a'), 60, 'Sparks drop by the setting price');

-- A passed starter price never applies to other items.
select is((select public.svc_buy_cosmetic('00000000-0000-0000-0000-00000000070b', 'hat-party', 'r1', 1) ->> 'price')::int, 300,
  'non-starter items keep their own price');

-- Without a passed price the catalogue price is the fallback.
select is((select public.svc_buy_cosmetic('00000000-0000-0000-0000-00000000070b', 'hat-starter', 'r2') ->> 'price')::int, 100,
  'the catalogue price applies when no setting is passed');

select throws_like($$ select public.svc_buy_cosmetic('00000000-0000-0000-0000-00000000070b', 'hat-chef', 'r3', -5) $$, '%bad price%',
  'a negative starter price is refused');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000070a", "role": "authenticated"}';
select throws_ok($$ select public.svc_buy_cosmetic('00000000-0000-0000-0000-00000000070a', 'hat-starter', 'r9', 0) $$,
  '42501', null, 'clients cannot pick their own starter price');

select * from finish();
rollback;
