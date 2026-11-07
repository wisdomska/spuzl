-- R2-ADMIN (admin cascade): per-game copy overrides for the admin Library page.
--
-- games.rule   the one-line rule (R2-06): the game shell's rule line and menu, the loading screen, How to play, the
--              Duel and Party "How it works" card and the Library game card.
-- games.blurb  the card copy: the short line under the game's name on its world page.
-- Both are one line (no line breaks), 1 to 130 characters after trimming. NULL means "use the default in
-- lib/catalog.ts", so existing rows need no backfill. Written only through the admin API (service role, audited);
-- read publicly through GET /api/v1/games/meta like typical_sec and tags.
--
-- Rollback:
--   alter table public.games drop column if exists rule, drop column if exists blurb;
--   delete from supabase_migrations.schema_migrations where version = '20261202000101';
alter table public.games
  add column if not exists rule text
    check (rule is null or (char_length(btrim(rule)) between 1 and 130 and rule = btrim(rule) and rule !~ '[\r\n]')),
  add column if not exists blurb text
    check (blurb is null or (char_length(btrim(blurb)) between 1 and 130 and blurb = btrim(blurb) and blurb !~ '[\r\n]'));
comment on column public.games.rule is 'One-line rule override, at most 130 characters (NULL = code default in lib/catalog.ts)';
comment on column public.games.blurb is 'Card copy override (world page line), at most 130 characters (NULL = code default)';
