-- Reopening (or dismissing) an actioned 18+ party report lifts the 18+ party block it caused.
--
-- Actioning a party-content report sets players.adult_party_blocked_until to now + "adultParty.blockDays"
-- (lib/multiplayer/server/adult.ts). When a moderator takes that decision back, the block should go with it,
-- unless another actioned party report on the same player still justifies one.
--
-- public.svc_adult_party_lift_block(player, report, days, actor) is called by the moderation route after a report
-- left the "actioned" status. Under a lock on the player row it works out what the player's other actioned party
-- reports still justify (the latest handled_at + days still in the future), and sets the block to that, never
-- later than the block in force, or clears it when nothing justifies one. A change writes an audit row
-- ('player.adult_party_unblock', target 'player:<id>') in the same transaction. Returns
-- {changed, before, blockedUntil}.
-- No new tables, so no RLS changes; the function is service role only.
--
-- Rollback:
--   drop function if exists public.svc_adult_party_lift_block(uuid, uuid, integer, uuid);
--   drop function if exists private.adult_party_lift_block(uuid, uuid, integer, uuid);
--   drop index if exists public.reports_party_actioned_idx;
--   delete from supabase_migrations.schema_migrations where version = '20261114000001';

create index if not exists reports_party_actioned_idx on public.reports (target_id, handled_at)
  where target_type = 'party' and status = 'actioned';

create or replace function private.adult_party_lift_block(p_player uuid, p_report uuid, p_days integer, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_before timestamptz;
  v_keep timestamptz;
  v_after timestamptz;
begin
  if p_days is null or p_days < 0 or p_days > 3650 then
    raise exception 'bad block days' using errcode = '22023';
  end if;
  select adult_party_blocked_until into v_before from public.players where id = p_player for update;
  if not found then raise exception 'player not found' using errcode = 'P0002'; end if;
  select max(r.handled_at + make_interval(days => p_days)) into v_keep
    from public.reports r
    where r.target_type = 'party' and r.target_id = p_player::text and r.status = 'actioned'
      and r.id is distinct from p_report and r.handled_at is not null;
  v_after := case
    when v_before is null or v_before <= now() then v_before
    when v_keep is null or v_keep <= now() then null
    else least(v_before, v_keep)
  end;
  if v_after is distinct from v_before then
    update public.players set adult_party_blocked_until = v_after where id = p_player;
    insert into public.audit_log (actor_id, action, target, detail)
      values (p_actor, 'player.adult_party_unblock', 'player:' || p_player,
              jsonb_build_object('report', p_report, 'before', v_before, 'after', v_after));
  end if;
  return jsonb_build_object('changed', v_after is distinct from v_before, 'before', v_before, 'blockedUntil', v_after);
end $$;

create or replace function public.svc_adult_party_lift_block(p_player uuid, p_report uuid, p_days integer, p_actor uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select private.adult_party_lift_block(p_player, p_report, p_days, p_actor)
$$;

revoke execute on function private.adult_party_lift_block(uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke execute on function public.svc_adult_party_lift_block(uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.svc_adult_party_lift_block(uuid, uuid, integer, uuid) to service_role;
