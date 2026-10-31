-- Shop hats from design S5 that were missing: Shades, Headphones and Chef Hat (drawn by components/meta/SpuzWear.tsx).
insert into public.cosmetics (id, type, name, price_sparks, rarity, payload, unlock_level, sort) values
  ('hat-shades', 'hat', 'Shades', 350, 'rare', '{"hat":"shades"}'::jsonb, null, 18),
  ('hat-headphones', 'hat', 'Headphones', 400, 'rare', '{"hat":"headphones"}'::jsonb, null, 19),
  ('hat-chef', 'hat', 'Chef Hat', 450, 'epic', '{"hat":"chef"}'::jsonb, null, 20)
on conflict (id) do update set name = excluded.name, price_sparks = excluded.price_sparks, rarity = excluded.rarity, payload = excluded.payload, sort = excluded.sort;
