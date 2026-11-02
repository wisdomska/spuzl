-- XP and Sparks for the 18+ party games (Draw It, Two Truths), which paid room points only.
--
-- What this adds:
--   party_rounds.played        who took part in the round (the drawer or writer who drew or wrote, everyone who
--                              guessed or voted), fixed by the app when the round closes, before its text and
--                              strokes are wiped. The end-of-room reward counts these rounds per player.
--   svc_grant_capped_reward    like svc_grant_reward (idempotent per player, source and ref), but clamps the XP
--                              to what is left of a daily cap for that source (GMT day) and pays the Sparks only
--                              while the player is under it. The player's row is locked first, so two rooms
--                              finishing together can't both pass the cap. A grant capped to 0 XP still writes
--                              a 0 XP ledger row, so that ref never pays later. Service role only.
-- RLS on party_rounds stays enabled and forced with no client policies or grants. No existing rows change
-- (played defaults to an empty list).
--
-- Rollback (one transaction):
--   drop function if exists public.svc_grant_capped_reward(uuid, text, text, integer, integer, integer);
--   drop function if exists private.grant_capped_reward(uuid, text, text, integer, integer, integer);
--   alter table public.party_rounds drop column if exists played;
--   delete from supabase_migrations.schema_migrations where version = '20261120000001';
-- Ledger rows already written with source 'party_adult' stay (the ledgers are append-only); they read like any
-- other XP and Sparks.

alter table public.party_rounds
  add column if not exists played uuid[] not null default '{}' check (cardinality(played) <= 8);

create or replace function private.grant_capped_reward(
  p_player uuid, p_source text, p_ref text, p_xp integer, p_sparks integer, p_cap integer
) returns table (xp_added integer, sparks_added integer, level_before integer, level_after integer)
language plpgsql security definer set search_path = '' as $$
declare lb integer; earned bigint; xp integer; sp integer;
begin
  select level into lb from public.players where id = p_player for update;
  if lb is null then raise exception 'unknown player'; end if;
  -- Already paid for this ref: nothing more (the ledgers' unique keys would also refuse it).
  if exists (select 1 from public.xp_ledger x where x.player_id = p_player and x.source = p_source and x.ref_id = p_ref)
     or exists (select 1 from public.sparks_ledger s where s.player_id = p_player and s.source = p_source and s.ref_id = p_ref) then
    xp_added := 0; sparks_added := 0; level_before := lb; level_after := lb;
    return next;
    return;
  end if;
  select coalesce(sum(x.amount), 0) into earned from public.xp_ledger x
   where x.player_id = p_player and x.source = p_source
     and x.created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
  xp := greatest(0, least(greatest(0, p_xp)::bigint, greatest(0, p_cap) - earned))::integer;
  sp := case when earned < greatest(0, p_cap) then greatest(0, p_sparks) else 0 end;
  -- Over the cap: a zero row still marks this ref as paid, so it never pays later (say, the next day).
  if xp = 0 then
    insert into public.xp_ledger (player_id, source, ref_id, amount) values (p_player, p_source, p_ref, 0)
      on conflict (player_id, source, ref_id) do nothing;
  end if;
  return query select * from private.grant_reward(p_player, p_source, p_ref, xp, sp);
end $$;
revoke execute on function private.grant_capped_reward(uuid, text, text, integer, integer, integer) from public, anon, authenticated;

create or replace function public.svc_grant_capped_reward(
  p_player uuid, p_source text, p_ref text, p_xp integer, p_sparks integer, p_cap integer
) returns table (xp_added integer, sparks_added integer, level_before integer, level_after integer)
language sql security definer set search_path = '' as $$
  select * from private.grant_capped_reward(p_player, p_source, p_ref, p_xp, p_sparks, p_cap)
$$;
revoke execute on function public.svc_grant_capped_reward(uuid, text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.svc_grant_capped_reward(uuid, text, text, integer, integer, integer) to service_role;
