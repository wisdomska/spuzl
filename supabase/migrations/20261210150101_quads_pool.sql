-- R4-15: approved Quads items join free play from the database in one click (admin Content).
--
-- content_items.pooled_at / pooled_by  set when an editor puts an approved (or scheduled) Quads item in the free-play
--                                      pool, cleared when it is taken out. Free play deals pooled items mixed with
--                                      games/quads/content.ts (each board picks one of all of them evenly). The groups
--                                      stay on the server: the item is read by the service role when the board is
--                                      built and checked; players only ever get the 16 words.
-- A check keeps the pool to editor-written Quads items that passed review (approved or scheduled; content.ts entries
-- are in free play already), so a draft or rejected item can never be dealt; a pooled item must be taken out before
-- its status moves anywhere else. Partial index for the free-play lookup. content_items keeps RLS forced with no client grants (unchanged).
--
-- Rollback:
--   drop index if exists public.content_items_quads_pool_idx;
--   alter table public.content_items drop constraint if exists content_items_pool_check;
--   alter table public.content_items drop column if exists pooled_at, drop column if exists pooled_by;
--   delete from supabase_migrations.schema_migrations where version = '20261210150101';
alter table public.content_items
  add column if not exists pooled_at timestamptz,
  add column if not exists pooled_by uuid references auth.users(id) on delete set null;
alter table public.content_items drop constraint if exists content_items_pool_check;
alter table public.content_items add constraint content_items_pool_check
  check (pooled_at is null or (game_id = 'quads' and source = 'editor' and status in ('approved', 'scheduled')));
create index if not exists content_items_quads_pool_idx on public.content_items (pooled_at) where pooled_at is not null;
comment on column public.content_items.pooled_at is
  'R4-15: when an approved Quads item joined the free-play pool (NULL = not in the pool)';
