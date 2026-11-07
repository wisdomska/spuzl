-- R2-P5: eleven retired games come back as lab games, switched on per game by the admin setting
-- "features.labGames" (a set of game ids in game_settings; lib/catalog.ts openGame, lib/game/service.ts
-- assertGameOpen). Their code, boards and content never left; until a game's id is in the setting the app hides it
-- and the server refuses it like an unknown game. The setting replaces the old all-or-nothing "features.newGames"
-- (its game_settings row, if any, is now ignored by the schema and left in place).
--
-- games.status: retired to coming_soon, as scripts/gen-seed.ts writes lab games. What reads it: daily_rollover's
-- missing-Dailies count and the live-ops gap alert (status = 'live', so lab games stay out of both, as before);
-- admin_clears_by_game and the games_read policy (status <> 'hidden', so the rows stay readable). Only rows still
-- 'retired' move, so a game someone already made live by hand keeps its status.
--
-- games.world_id: the Number Den and Clue Cave games move to the group that took their kind of game in the 2026-11
-- regroup (Higher or Lower, Market Run, Killer Sums to Puzzles; Pinned, Flagged to Words & Quiz), so a switched-on
-- lab game shows on a live world. Explorer badges count only live games, so they do not change.
--
-- games.sort follows the catalogue: live games, then the retired ones, then the lab games in the order they came
-- back (seed.sql is regenerated from it). No rows are deleted or added; old attempts, Dailies, puzzles and results
-- for these games stay as they were.
--
-- Rollback:
--   update public.games set status = 'retired'
--     where status = 'coming_soon'
--       and id in ('five', 'hilo', 'penalty', 'market', 'lightup', 'killer', 'dara', 'pinned', 'flagged', 'tripwire', 'pixl');
--   update public.games set world_id = 'number' where id in ('hilo', 'market', 'killer');
--   update public.games set world_id = 'clue' where id in ('pinned', 'flagged');
--   update public.games g set sort = s.sort from (values
--     ('pixl', 29), ('blackout', 30), ('tripwire', 31), ('isles', 32), ('quilt', 33), ('snug', 34), ('shuffle', 35),
--     ('reflect', 36), ('squint', 37), ('deadon', 38), ('merge', 39), ('sums', 40), ('equal', 41), ('hunch', 42),
--     ('pinned', 43), ('flagged', 44), ('flipside', 45), ('ricochet', 46), ('stacked', 47), ('wobble', 48),
--     ('grapple', 49), ('ghosted', 50), ('slip', 51), ('gauntlet', 52), ('flip', 53), ('penalty', 54), ('hilo', 55),
--     ('market', 56), ('five', 57), ('lightup', 58), ('killer', 59), ('dara', 60)
--   ) as s(id, sort) where g.id = s.id;
--   delete from public.game_settings where key = 'features.labGames';
--   delete from supabase_migrations.schema_migrations where version = '20261203005101';

update public.games set status = 'coming_soon'
where status = 'retired'
  and id in ('five', 'hilo', 'penalty', 'market', 'lightup', 'killer', 'dara', 'pinned', 'flagged', 'tripwire', 'pixl');

update public.games set world_id = 'logic' where id in ('hilo', 'market', 'killer');
update public.games set world_id = 'word' where id in ('pinned', 'flagged');

-- Catalogue order, as scripts/gen-seed.ts writes it: the 29 live games keep 0 to 28; the 21 retired games follow
-- (29 to 49), then the 11 lab games (50 to 60).
update public.games g
set sort = s.sort
from (
  values
    ('blackout', 29), ('isles', 30), ('quilt', 31), ('snug', 32), ('shuffle', 33), ('reflect', 34), ('squint', 35),
    ('deadon', 36), ('merge', 37), ('sums', 38), ('equal', 39), ('hunch', 40), ('flipside', 41), ('ricochet', 42),
    ('stacked', 43), ('wobble', 44), ('grapple', 45), ('ghosted', 46), ('slip', 47), ('gauntlet', 48), ('flip', 49),
    ('five', 50), ('hilo', 51), ('penalty', 52), ('market', 53), ('lightup', 54), ('killer', 55), ('dara', 56),
    ('pinned', 57), ('flagged', 58), ('tripwire', 59), ('pixl', 60)
) as s(id, sort)
where g.id = s.id;
