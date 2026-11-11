-- The owner made the twelve lab games permanent (11 Nov 2026): Five, Higher or Lower, Penalty King, Market Run,
-- Light Up, Killer Sums, Dara, Pinned, Flagged, Tripwire, Pixl and Two Truths and a Lie leave the lab and join the
-- live games, so the catalogue has 41 (lib/catalog.ts drops `lab: true`; LAB_GAMES is empty for now). Their worlds
-- stay: Five, Pinned, Flagged and Two Truths in Words & Quiz; Higher or Lower, Market Run, Light Up, Killer Sums,
-- Tripwire and Pixl in Puzzles; Penalty King in Arcade; Dara in Board Games.
--
-- games.status: coming_soon to live. What reads it: daily_rollover's missing-Dailies count and the live-ops gap
-- alert (status = 'live', so the Daily filler and the alert cover the twelve from now on), admin_clears_by_game and
-- the games_read policy (status <> 'hidden', unchanged for them). Only rows still 'coming_soon' move, so a game
-- someone hid by hand stays hidden. No rows are added or deleted; attempts, Dailies, puzzles and results stay.
--
-- games.sort follows the catalogue, as scripts/gen-seed.ts writes it (seed.sql is regenerated from it): the 41 live
-- games first, each graduated game in its world's natural place, then the 21 retired games.
--
-- The "features.labGames" row in game_settings is left as it is, on purpose. The app no longer offers those ids as
-- options, so the schema ignores the stored value (mergeSettings falls back to the empty default) and the admin
-- page shows the setting at its default with "No games in testing right now". Keeping the row means the order of
-- deploy and migration does not matter: if this runs before the new code ships, the old code still finds the twelve
-- switched on and players never lose them for a moment. It can be cleared from the admin page at any time.
--
-- Rollback (puts the twelve back in the lab; with the old code, "features.labGames" decides who sees them again):
--   update public.games set status = 'coming_soon'
--     where status = 'live'
--       and id in ('five', 'hilo', 'penalty', 'market', 'lightup', 'killer', 'dara', 'pinned', 'flagged', 'tripwire',
--                  'pixl', 'twotruths');
--   update public.games g set sort = s.sort from (values
--     ('crownfall', 0), ('dusk', 1), ('sixer', 2), ('nine', 3), ('weave', 4), ('flowline', 5), ('pairup', 6),
--     ('lost', 7), ('trotro', 8), ('coil', 9), ('rungs', 10), ('quads', 11), ('seven', 12), ('minicross', 13),
--     ('buried', 14), ('remix', 15), ('quickfire', 16), ('emojihits', 17), ('echo', 18), ('twins', 19),
--     ('flinch', 20), ('beattap', 21), ('gotcha', 22), ('dash', 23), ('chess', 24), ('draughts', 25), ('oware', 26),
--     ('ludo', 27), ('fourup', 28), ('blackout', 29), ('isles', 30), ('quilt', 31), ('snug', 32), ('shuffle', 33),
--     ('reflect', 34), ('squint', 35), ('deadon', 36), ('merge', 37), ('sums', 38), ('equal', 39), ('hunch', 40),
--     ('flipside', 41), ('ricochet', 42), ('stacked', 43), ('wobble', 44), ('grapple', 45), ('ghosted', 46),
--     ('slip', 47), ('gauntlet', 48), ('flip', 49), ('five', 50), ('hilo', 51), ('penalty', 52), ('market', 53),
--     ('lightup', 54), ('killer', 55), ('dara', 56), ('pinned', 57), ('flagged', 58), ('tripwire', 59), ('pixl', 60),
--     ('twotruths', 61)
--   ) as s(id, sort) where g.id = s.id;
--   delete from supabase_migrations.schema_migrations where version = '20261211300101';

update public.games set status = 'live'
where status = 'coming_soon'
  and id in ('five', 'hilo', 'penalty', 'market', 'lightup', 'killer', 'dara', 'pinned', 'flagged', 'tripwire', 'pixl',
             'twotruths');

update public.games g
set sort = s.sort
from (
  values
    -- Puzzles
    ('crownfall', 0), ('dusk', 1), ('sixer', 2), ('nine', 3), ('killer', 4), ('lightup', 5), ('pixl', 6),
    ('tripwire', 7), ('weave', 8), ('flowline', 9), ('pairup', 10), ('lost', 11), ('trotro', 12), ('market', 13),
    ('hilo', 14),
    -- Words & Quiz
    ('coil', 15), ('rungs', 16), ('quads', 17), ('seven', 18), ('minicross', 19), ('buried', 20), ('remix', 21),
    ('five', 22), ('quickfire', 23), ('emojihits', 24), ('pinned', 25), ('flagged', 26), ('twotruths', 27),
    -- Arcade
    ('echo', 28), ('twins', 29), ('flinch', 30), ('beattap', 31), ('penalty', 32), ('gotcha', 33), ('dash', 34),
    -- Board Games
    ('chess', 35), ('draughts', 36), ('oware', 37), ('ludo', 38), ('fourup', 39), ('dara', 40),
    -- Retired
    ('blackout', 41), ('isles', 42), ('quilt', 43), ('snug', 44), ('shuffle', 45), ('reflect', 46), ('squint', 47),
    ('deadon', 48), ('merge', 49), ('sums', 50), ('equal', 51), ('hunch', 52), ('flipside', 53), ('ricochet', 54),
    ('stacked', 55), ('wobble', 56), ('grapple', 57), ('ghosted', 58), ('slip', 59), ('gauntlet', 60), ('flip', 61)
) as s(id, sort)
where g.id = s.id;
