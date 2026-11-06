-- R2-18: the Library's "new" tag (Home's "N new games" banner and the Library's New filter). games.tags may now hold
-- 'new' next to quick, calm and competitive, so the admin Library page can mark or unmark a game as new. NULL still
-- means "use the default in lib/games-meta" (the catalog's isNew), so no backfill.
-- Rollback (removes 'new' from overrides first, so the old check holds):
--   update public.games set tags = array_remove(tags, 'new') where 'new' = any(tags);
--   alter table public.games drop constraint if exists games_tags_check;
--   alter table public.games add constraint games_tags_check check (tags <@ array['quick', 'calm', 'competitive']::text[]);
--   comment on column public.games.tags is 'Library filter tags override: quick, calm, competitive (NULL = code default)';
alter table public.games drop constraint if exists games_tags_check;
alter table public.games
  add constraint games_tags_check check (tags <@ array['quick', 'calm', 'competitive', 'new']::text[]);
comment on column public.games.tags is 'Library filter tags override: quick, calm, competitive, new (NULL = code default)';
