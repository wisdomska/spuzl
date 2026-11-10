-- R4-Q (owner decision Q, 10 Nov 2026): 18+ party rooms (Draw It, Two Truths) count toward quests and badges, and
-- pay XP as before, but never reach the friends feed (friends of any age read it). A badge earned in an 18+ room is
-- awarded through svc_award_badge_quiet, which marks its own transaction so the badge trigger writes no feed event.
--
-- What this changes:
--   private.on_badge_earned()        unchanged for every other insert (copied from 20261102000001_social_meta);
--                                    skips the 'badge' feed event when the transaction-local setting
--                                    spuzl.quiet_feed is 'on'.
--   public.svc_award_badge_quiet(p_player uuid, p_badge text) returns boolean
--                                    sets spuzl.quiet_feed for its own transaction only, inserts the badge (once;
--                                    true when it was new, false when the player already had it). Service role only.
-- No table or data changes. Existing feed events stay.
--
-- Rollback (one transaction):
--   drop function if exists public.svc_award_badge_quiet(uuid, text);
--   create or replace function private.on_badge_earned() returns trigger
--   language plpgsql security definer set search_path = '' as $$
--   begin
--     insert into public.feed_events (player_id, kind, payload) values (new.player_id, 'badge', jsonb_build_object('badge', new.badge_id));
--     return new;
--   end $$;
--   delete from supabase_migrations.schema_migrations where version = '20261210990101';

create or replace function private.on_badge_earned() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- An 18+ party room's badge (svc_award_badge_quiet): no friends feed event.
  if coalesce(current_setting('spuzl.quiet_feed', true), '') = 'on' then
    return new;
  end if;
  insert into public.feed_events (player_id, kind, payload) values (new.player_id, 'badge', jsonb_build_object('badge', new.badge_id));
  return new;
end $$;

create or replace function public.svc_award_badge_quiet(p_player uuid, p_badge text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare added integer;
begin
  perform set_config('spuzl.quiet_feed', 'on', true);
  insert into public.player_badges (player_id, badge_id) values (p_player, p_badge)
    on conflict (player_id, badge_id) do nothing;
  get diagnostics added = row_count;
  perform set_config('spuzl.quiet_feed', '', true);
  return added > 0;
end $$;
revoke execute on function public.svc_award_badge_quiet(uuid, text) from public, anon, authenticated;
grant execute on function public.svc_award_badge_quiet(uuid, text) to service_role;
