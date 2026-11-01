-- Server move log for guess-transport games (1.2.0 follow-up: Five and Emoji Hits "show the answer").
-- public.attempts.moves (jsonb, unused until now) holds what the guess route recorded while an attempt was
-- played: shown answers, checked words, committed shots, each with a server time `t`. Finish audits the
-- final state against it (a shown answer can't then be scored as a clean solve), and the moderation view
-- already reads its `t` stamps as input timing.
-- public.svc_attempt_log appends one entry, only to the player's own in-progress attempt and only while the
-- log still has p_len entries, so two guesses at once can't both act on the same log. Service role only.
-- Rollback:
--   drop function if exists public.svc_attempt_log(uuid, uuid, integer, jsonb);
--   delete from supabase_migrations.schema_migrations where version = '20261110000001';

create or replace function public.svc_attempt_log(p_attempt uuid, p_player uuid, p_len integer, p_entry jsonb)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.attempts a
     set moves = (case when jsonb_typeof(a.moves) = 'array' then a.moves else '[]'::jsonb end) || jsonb_build_array(p_entry)
   where a.id = p_attempt
     and a.player_id = p_player
     and a.status = 'in_progress'
     and (case when jsonb_typeof(a.moves) = 'array' then jsonb_array_length(a.moves) else 0 end) = p_len;
  get diagnostics n = row_count;
  return n = 1;
end $$;

revoke execute on function public.svc_attempt_log(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.svc_attempt_log(uuid, uuid, integer, jsonb) to service_role;
