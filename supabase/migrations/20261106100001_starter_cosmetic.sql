-- SPZ-19: a starter hat a new player can afford after their first few clears.
-- The live price is the admin game setting `shop.starterPrice` (lib/game-settings/schema.ts). The API reads it at
-- purchase time and passes it as p_starter_price; the function charges that price for any cosmetic whose payload
-- carries "starter" (the shop lists it first). price_sparks stays as the fallback when no price is passed (direct SQL callers, tests).
--
-- Rollback:
--   drop function if exists public.svc_buy_cosmetic(uuid, text, text, integer);
--   drop function if exists private.buy_cosmetic(uuid, text, text, integer);
--   -- then re-run the private.buy_cosmetic(uuid, text, text) and public.svc_buy_cosmetic(uuid, text, text)
--   -- definitions and their revoke/grant lines from 20261102000001_social_meta.sql.
--   update public.players set hat = null where hat = 'beanie';
--   delete from public.inventory where cosmetic_id = 'hat-starter';
--   delete from public.cosmetics where id = 'hat-starter';

insert into public.cosmetics (id, type, name, price_sparks, rarity, payload, unlock_level, sort) values
  ('hat-starter', 'hat', 'Sprout Beanie', 100, 'common', '{"hat":"beanie","starter":1}'::jsonb, null, 21)
on conflict (id) do update set name = excluded.name, price_sparks = excluded.price_sparks, rarity = excluded.rarity,
  payload = excluded.payload, sort = excluded.sort;

-- The 3-argument versions are replaced by one 4-argument version; p_starter_price defaults to null, so existing
-- 3-argument calls keep working.
drop function if exists public.svc_buy_cosmetic(uuid, text, text);
drop function if exists private.buy_cosmetic(uuid, text, text);

create or replace function private.buy_cosmetic(p_player uuid, p_item text, p_request text, p_starter_price integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.cosmetics; lvl integer; bal bigint; held smallint; price integer; ref text := p_item || ':' || p_request;
begin
  if p_starter_price is not null and p_starter_price < 0 then raise exception 'bad price'; end if;
  select * into c from public.cosmetics where id = p_item and active;
  if not found then raise exception 'unknown_item'; end if;
  price := case when c.payload ? 'starter' and p_starter_price is not null then p_starter_price else c.price_sparks end;
  select level, sparks into lvl, bal from public.players where id = p_player for update;
  if lvl is null then raise exception 'unknown player'; end if;
  if exists (select 1 from public.sparks_ledger where player_id = p_player and source = 'shop' and ref_id = ref) then
    return jsonb_build_object('status', 'duplicate', 'sparks', bal);
  end if;
  if c.unlock_level is not null and lvl < c.unlock_level then raise exception 'locked'; end if;
  if c.type not in ('freeze', 'hint_pack') and exists (select 1 from public.inventory where player_id = p_player and cosmetic_id = p_item) then
    raise exception 'owned';
  end if;
  if c.type = 'freeze' then
    insert into public.streaks (player_id) values (p_player) on conflict do nothing;
    select freezes_held into held from public.streaks where player_id = p_player for update;
    if held >= 2 then raise exception 'freeze_full'; end if;
  end if;
  if price > 0 then
    bal := private.spend_sparks(p_player, 'shop', ref, price);
  end if;
  if c.type = 'freeze' then
    update public.streaks set freezes_held = freezes_held + 1, updated_at = now() where player_id = p_player;
  elsif c.type = 'hint_pack' then
    update public.players set practice_hints = practice_hints + coalesce((c.payload ->> 'hints')::int, 5) where id = p_player;
  else
    insert into public.inventory (player_id, cosmetic_id) values (p_player, p_item);
  end if;
  return jsonb_build_object('status', 'bought', 'sparks', bal, 'price', price);
end $$;

create or replace function public.svc_buy_cosmetic(p_player uuid, p_item text, p_request text, p_starter_price integer default null)
returns jsonb language sql security definer set search_path = '' as $$
  select private.buy_cosmetic(p_player, p_item, p_request, p_starter_price)
$$;

revoke execute on function private.buy_cosmetic(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.svc_buy_cosmetic(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.svc_buy_cosmetic(uuid, text, text, integer) to service_role;
