begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- R4-H (20261210720101): a hat reaches other players only when its wearer owns it. Player o owns and wears Shades;
-- player f has 'shades' in players.hat but never bought it; player r bought Headphones, wears them, then loses the
-- inventory row (refund or admin removal); player k owns a skin whose payload says "shades" (not a hat).
insert into auth.users (id, email) select ('00000000-0000-0000-0000-0000000172' || c)::uuid, c || '@hats.test'
  from unnest(array['0a', '0b', '0c', '0d']) c;
insert into public.players (id, nickname, age_band, country, city, hat) values
  ('00000000-0000-0000-0000-00000001720a', 'hat_owner', '18+', 'GH', 'Accra', 'shades'),
  ('00000000-0000-0000-0000-00000001720b', 'hat_fake', '18+', 'GH', 'Accra', 'shades'),
  ('00000000-0000-0000-0000-00000001720c', 'hat_refund', '18+', 'GH', 'Accra', 'headphones'),
  ('00000000-0000-0000-0000-00000001720d', 'hat_skin', '18+', 'GH', 'Accra', 'shades');
insert into public.cosmetics (id, type, name, price_sparks, payload) values
  ('skin-r4h-test', 'skin', 'Test skin', 0, '{"hat":"shades","color":"#B8F23A"}'::jsonb)
on conflict (id) do nothing;
insert into public.inventory (player_id, cosmetic_id, equipped) values
  ('00000000-0000-0000-0000-00000001720a', 'hat-shades', true),
  ('00000000-0000-0000-0000-00000001720c', 'hat-headphones', true),
  ('00000000-0000-0000-0000-00000001720d', 'skin-r4h-test', true);
delete from public.inventory where player_id = '00000000-0000-0000-0000-00000001720c';
insert into public.daily_results (date, game_id, player_id, time_ms, hints, mistakes, finished_at)
  select '2001-03-04', 'crownfall', id, 60000, 0, 0, '2001-03-04 10:00+00' from public.players
  where id::text like '00000000-0000-0000-0000-0000000172%';

-- private.owned_hat
select is(private.owned_hat('00000000-0000-0000-0000-00000001720a', 'shades'), 'shades', 'an owned hat comes back');
select is(private.owned_hat('00000000-0000-0000-0000-00000001720b', 'shades'), null, 'a hat never bought does not');
select is(private.owned_hat('00000000-0000-0000-0000-00000001720c', 'headphones'), null, 'a hat whose inventory row is gone does not');
select is(private.owned_hat('00000000-0000-0000-0000-00000001720d', 'shades'), null, 'a non-hat item never counts as the hat');
select is(private.owned_hat('00000000-0000-0000-0000-00000001720a', 'crown'), null, 'owning one hat does not unlock another');

-- public.owned_hat (the computed field server reads select as hat:owned_hat)
select is((select string_agg(p.nickname || '=' || coalesce(public.owned_hat(p), '-'), ',' order by p.nickname) from public.players p
  where p.id::text like '00000000-0000-0000-0000-0000000172%'),
  'hat_fake=-,hat_owner=shades,hat_refund=-,hat_skin=-', 'the computed field keeps only owned hats');

-- public.player_cards
select is((select string_agg(nickname || '=' || coalesce(hat, '-'), ',' order by nickname) from public.player_cards
  where id::text like '00000000-0000-0000-0000-0000000172%'),
  'hat_fake=-,hat_owner=shades,hat_refund=-,hat_skin=-', 'player cards show only owned hats');

-- public.svc_leaderboard
select is((select string_agg(nickname || '=' || coalesce(hat, '-'), ',' order by nickname)
  from public.svc_leaderboard('00000000-0000-0000-0000-00000001720a', 'crownfall', '2001-03-04', 'global')
  where nickname like 'hat\_%'),
  'hat_fake=-,hat_owner=shades,hat_refund=-,hat_skin=-', 'the leaderboard shows only owned hats');
select is((select count(*)::int from public.svc_leaderboard('00000000-0000-0000-0000-00000001720a', 'crownfall', '2001-03-04', 'global')
  where nickname like 'hat\_%'), 4, 'nobody drops off the board for an unowned hat');

-- Buying it later makes it show; the stored column itself is untouched
insert into public.inventory (player_id, cosmetic_id) values ('00000000-0000-0000-0000-00000001720b', 'hat-shades');
select is((select hat from public.player_cards where id = '00000000-0000-0000-0000-00000001720b'), 'shades', 'once bought, the hat shows');

-- Grants: the helpers are server-only; player_cards stays readable
select ok(not has_function_privilege('authenticated', 'public.owned_hat(public.players)', 'execute'), 'players cannot call owned_hat');
select ok(not has_function_privilege('anon', 'public.owned_hat(public.players)', 'execute'), 'visitors cannot call owned_hat');
select ok(has_function_privilege('service_role', 'public.owned_hat(public.players)', 'execute'), 'the service role can');
select ok(not has_function_privilege('authenticated', 'private.owned_hat(uuid, text)', 'execute'), 'the private helper stays private');

select * from finish();
rollback;
