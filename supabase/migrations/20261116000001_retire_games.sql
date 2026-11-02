-- The owner narrowed SPUZL to 29 games. 32 games are retired: their code stays (lib/catalog.ts RETIRED_IDS) so
-- they can come back, but the app hides them and the server refuses them like an unknown game. Trotro Jam, Emoji
-- Hits and Beat Tap graduate from the lab ("features.newGames") to live.
--
-- games.status gains 'retired'. What reads it: daily_rollover's missing-Dailies count and the live-ops gap alert
-- (status = 'live', so retired games drop out of both); admin_clears_by_game and the games_read policy
-- (status <> 'hidden', so old results keep their game row and the admin console still lists them).
-- No rows are deleted: attempts, Dailies, puzzles and results for retired games stay as they were.
--
-- Rollback:
--   update public.games set status = 'coming_soon' where id in ('trotro', 'emojihits', 'beattap');
--   update public.games set status = 'coming_soon'
--     where id in ('lightup', 'hilo', 'market', 'killer', 'five', 'penalty', 'dara');
--   update public.games set status = 'live' where status = 'retired';
--   alter table public.games drop constraint games_status_check;
--   alter table public.games add constraint games_status_check check (status in ('live', 'coming_soon', 'hidden'));
--   delete from supabase_migrations.schema_migrations where version = '20261116000001';

alter table public.games drop constraint if exists games_status_check;
alter table public.games
  add constraint games_status_check check (status in ('live', 'coming_soon', 'hidden', 'retired'));

update public.games set status = 'retired'
where id in (
  -- Logic Lab
  'pixl', 'blackout', 'tripwire', 'lightup',
  -- Line Lane
  'isles',
  -- Shape Shed
  'quilt', 'snug', 'shuffle', 'reflect', 'squint',
  -- Number Den (the whole world)
  'deadon', 'merge', 'sums', 'equal', 'hilo', 'market', 'killer',
  -- Word Woods
  'quads', 'five',
  -- Clue Cave
  'hunch', 'pinned', 'flagged',
  -- Reflex Rink
  'penalty',
  -- Rage Ridge
  'flipside', 'ricochet', 'stacked', 'wobble', 'grapple', 'ghosted', 'slip',
  -- Board Bay
  'flip', 'dara'
);

update public.games set status = 'live' where id in ('trotro', 'emojihits', 'beattap');
