-- 20261102000001_social_meta revokes execute on every function in schema private, which also removed the
-- grant that 20261101000001_multiplayer gave private.can_use_topic. The Realtime channel policies call it
-- as the player, so on a fresh database nobody could join a match channel. Restore it.
grant execute on function private.can_use_topic(text) to authenticated;
