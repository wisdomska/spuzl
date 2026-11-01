-- SPZ-14: per-game Library metadata the admin console can override (duration chip and filter tags).
-- NULL means "use the default in lib/games-meta" so existing rows need no backfill.
-- Rollback: alter table public.games drop column if exists typical_sec, drop column if exists tags;
alter table public.games
  add column if not exists typical_sec integer check (typical_sec between 10 and 3600),
  add column if not exists tags text[] check (tags <@ array['quick', 'calm', 'competitive']::text[]);
comment on column public.games.typical_sec is 'Library duration chip override in seconds (NULL = code default)';
comment on column public.games.tags is 'Library filter tags override: quick, calm, competitive (NULL = code default)';
