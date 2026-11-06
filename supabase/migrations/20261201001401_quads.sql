-- R2-14: Quads comes back. It was retired with 31 other games in 20261116000001 (its code, board and content
-- stayed); now it is live again in Words & Quiz, so the catalogue has 29 live games (lib/catalog.ts takes it out
-- of RETIRED_IDS and marks it new for the Home "new games" banner).
--
-- What reads games.status: daily_rollover's missing-Dailies count and the live-ops gap alert (status = 'live', so
-- the Daily filler and the alert cover Quads again), admin_clears_by_game and the games_read policy. Its old
-- attempts, Dailies, puzzles and results were never deleted, so they show again as they were. The sort puts it
-- after Rungs, as in the catalogue (seed.sql is regenerated from it).
--
-- Rollback (sort only orders lists, so the rollback leaves the new order in place):
--   update public.games set status = 'retired' where id = 'quads';
--   delete from supabase_migrations.schema_migrations where version = '20261201001401';

update public.games set status = 'live' where id = 'quads';

-- Catalogue order, as scripts/gen-seed.ts writes it: live games first (Rungs is 10, so Quads is 11 and the rest move
-- down one), then the retired games (each one up, now that Quads left them; Gauntlet joins them at 52).
update public.games g
set sort = s.sort
from (
  values
    ('quads', 11), ('seven', 12), ('minicross', 13), ('buried', 14), ('remix', 15), ('quickfire', 16),
    ('emojihits', 17), ('echo', 18), ('twins', 19), ('flinch', 20), ('beattap', 21), ('gotcha', 22), ('dash', 23),
    ('hunch', 42), ('pinned', 43), ('flagged', 44), ('flipside', 45), ('ricochet', 46), ('stacked', 47), ('wobble', 48),
    ('grapple', 49), ('ghosted', 50), ('slip', 51), ('gauntlet', 52)
) as s(id, sort)
where g.id = s.id;
