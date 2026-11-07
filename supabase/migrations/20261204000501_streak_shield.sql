-- R2-P5: streak shield for guests who sign in (admin setting "features.streakShield").
-- A guest who links an email or Google account to their guest account gets one Streak Freeze (the shop's `freeze`
-- item: streaks.freezes_held, at most 2), once per account. Once only is enforced here by a ledger ref: a
-- zero-amount row in public.sparks_ledger (source 'shield', ref 'signin'; unique per player, append only), taken
-- in the same transaction as the grant, and only while the player row still says is_guest (POST
-- /api/v1/account/sync calls this before it clears is_guest). A player already holding 2 Freezes keeps them and
-- the ref is still taken (status 'full'). Every grant writes the audit log (action player.shield, no actor), so it
-- shows in the admin player detail next to admin Freeze grants.
-- Service role only. No table, grant or policy changes.
-- Rollback:
--   drop function if exists public.svc_signin_shield(uuid);
--   drop function if exists private.signin_shield(uuid);
--   delete from supabase_migrations.schema_migrations where version = '20261204000501';
--   (Freezes already granted and their ledger and audit rows stay: both tables are append only.)

create or replace function private.signin_shield(p_player uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare was_guest boolean; held smallint;
begin
  select is_guest into was_guest from public.players where id = p_player for update;
  if was_guest is null then raise exception 'player not found' using errcode = 'P0002'; end if;
  if not was_guest then return jsonb_build_object('status', 'not_guest'); end if;
  if exists (select 1 from public.sparks_ledger where player_id = p_player and source = 'shield' and ref_id = 'signin') then
    return jsonb_build_object('status', 'already');
  end if;
  insert into public.sparks_ledger (player_id, source, ref_id, amount) values (p_player, 'shield', 'signin', 0);
  insert into public.streaks (player_id) values (p_player) on conflict (player_id) do nothing;
  select freezes_held into held from public.streaks where player_id = p_player for update;
  if held >= 2 then
    insert into public.audit_log (actor_id, action, target, detail)
      values (null, 'player.shield', 'player:' || p_player, jsonb_build_object('held', held, 'granted', false, 'reason', 'signed in, Freezes already full'));
    return jsonb_build_object('status', 'full', 'freezes', held);
  end if;
  update public.streaks set freezes_held = freezes_held + 1, updated_at = now() where player_id = p_player;
  insert into public.audit_log (actor_id, action, target, detail)
    values (null, 'player.shield', 'player:' || p_player, jsonb_build_object('held', held + 1, 'granted', true, 'reason', 'signed in: streak shield'));
  return jsonb_build_object('status', 'granted', 'freezes', held + 1);
end $$;

create or replace function public.svc_signin_shield(p_player uuid)
returns jsonb language sql security definer set search_path = '' as $$ select private.signin_shield(p_player) $$;

revoke execute on function private.signin_shield(uuid) from public, anon, authenticated;
revoke execute on function public.svc_signin_shield(uuid) from public, anon, authenticated;
grant execute on function public.svc_signin_shield(uuid) to service_role;
