-- R4-24: Draw It live ink is stamped by the server. The drawer posts each live batch to /api/v1/ink, which checks
-- the drawer's pass and broadcasts the batch itself (service role) on the room's ink channel, `ink:<match id>`.
-- Members of the match may read that channel, but nobody may publish on it from a client, so a member can no
-- longer forge a line in the drawer's name.
--
-- What this changes:
--   private.can_use_topic(t)    also knows `ink:<match uuid>`: readable by the same members as `match:<uuid>`
--                               (copied from 20261101000001_multiplayer with every existing branch kept).
--   private.can_send_topic(t)   new: what a client may publish on; every topic it may use except `ink:`.
--   spuzl_realtime_write        the insert policy on realtime.messages now calls can_send_topic, so a client
--                               broadcast on an ink channel is refused. The read policy is unchanged.
-- No table or data changes.
--
-- Rollback (one transaction):
--   drop policy if exists spuzl_realtime_write on realtime.messages;
--   create policy spuzl_realtime_write on realtime.messages for insert to authenticated
--     with check ((select private.can_use_topic((select realtime.topic()))));
--   drop function if exists private.can_send_topic(text);
--   create or replace function private.can_use_topic(t text) ... (the body from 20261101000001_multiplayer);
--   grant execute on function private.can_use_topic(text) to authenticated;
--   delete from supabase_migrations.schema_migrations where version = '20261210240101';

create or replace function private.can_use_topic(t text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare tid uuid; kind text := split_part(t, ':', 1);
begin
  begin
    tid := split_part(t, ':', 2)::uuid;
  exception when others then
    return false;
  end;
  if kind = 'match' or kind = 'ink' then
    return exists (select 1 from public.match_players where match_id = tid and player_id = (select auth.uid()) and left_at is null);
  elsif kind = 'bay' then
    return exists (select 1 from public.board_matches where board_matches.id = tid and (select auth.uid()) = any (players));
  elsif kind = 'user' then
    return tid = (select auth.uid());
  end if;
  return false;
end $$;
revoke execute on function private.can_use_topic(text) from public, anon;
grant execute on function private.can_use_topic(text) to authenticated;

create or replace function private.can_send_topic(t text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  -- The ink channel is written by the server only (/api/v1/ink, service role, which bypasses RLS).
  if split_part(t, ':', 1) = 'ink' then
    return false;
  end if;
  return private.can_use_topic(t);
end $$;
revoke execute on function private.can_send_topic(text) from public, anon;
grant execute on function private.can_send_topic(text) to authenticated;

drop policy if exists spuzl_realtime_write on realtime.messages;
create policy spuzl_realtime_write on realtime.messages for insert to authenticated
  with check ((select private.can_send_topic((select realtime.topic()))));
