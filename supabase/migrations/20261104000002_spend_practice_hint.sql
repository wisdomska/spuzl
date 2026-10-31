-- Hint packs from the Shop add to players.practice_hints. After the 3 free hints of a free-play or archive
-- puzzle, one banked hint is spent per extra hint, atomically (never below zero).
create or replace function public.svc_spend_practice_hint(p_player uuid) returns boolean
language sql security definer set search_path = '' as $$
  with spent as (
    update public.players set practice_hints = practice_hints - 1
    where id = p_player and practice_hints > 0
    returning 1
  )
  select exists (select 1 from spent)
$$;
revoke execute on function public.svc_spend_practice_hint(uuid) from public, anon, authenticated;
grant execute on function public.svc_spend_practice_hint(uuid) to service_role;
