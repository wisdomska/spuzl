-- Round 3 item 12: content review queue. The admin Content page's Review view lets content editors and the owner
-- approve, edit or retire each entry of a game's content.ts that is marked needsReview (Two Truths, Pinned, Flagged,
-- Pixl and the rest). The current decision per entry stays in public.content_items (source 'content_file', one row
-- per entry, as since 20261103000001); this adds the full history and the retired state.
--
-- What this changes:
--   content_items.status       also takes 'retired': a content.ts entry that is never dealt to players (every game's
--                              picker leaves it out on the server, games/_shared/live.ts). Entries the owner rejected
--                              before (status 'rejected', source 'content_file') become 'retired', which is what a
--                              rejection meant; editor drafts keep 'rejected'.
--   public.content_reviews     append-only history: game, entry ref and hash, decision (approve, edit, retire,
--                              restore), the edited entry for an edit, notes, who and when. Never updated or deleted.
-- A game's needsReview is derived from these rows (every entry reviewed while unchanged in code), not edited in code.
-- Server only: RLS enabled and forced on content_reviews, no grants to anon or authenticated; the API writes with the
-- service role and also writes the audit log (content_file.*).
--
-- Rollback (one transaction; retired entries are dealt again):
--   drop table if exists public.content_reviews;
--   update public.content_items set status = 'rejected' where source = 'content_file' and status = 'retired';
--   alter table public.content_items drop constraint if exists content_items_status_check;
--   alter table public.content_items add constraint content_items_status_check
--     check (status in ('draft', 'in_review', 'approved', 'rejected', 'scheduled'));
--   delete from supabase_migrations.schema_migrations where version = '20261207001201';

alter table public.content_items drop constraint if exists content_items_status_check;
alter table public.content_items add constraint content_items_status_check
  check (status in ('draft', 'in_review', 'approved', 'rejected', 'scheduled', 'retired'));
-- Only content.ts entries are retired; an editor's draft is rejected instead.
alter table public.content_items drop constraint if exists content_items_retired_is_file;
alter table public.content_items add constraint content_items_retired_is_file
  check (status <> 'retired' or source = 'content_file');

update public.content_items set status = 'retired' where source = 'content_file' and status = 'rejected';

create table if not exists public.content_reviews (
  id bigint generated always as identity primary key,
  game_id text not null references public.games (id),
  source_ref text not null check (char_length(source_ref) <= 80),
  source_hash text not null check (char_length(source_hash) <= 64),
  decision text not null check (decision in ('approve', 'edit', 'retire', 'restore')),
  payload jsonb check ((decision = 'edit') = (payload is not null)),
  notes text check (notes is null or char_length(notes) <= 2000),
  -- no foreign key: the history is append-only, so a cascade could never null it (who stays readable as an id)
  reviewer_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists content_reviews_ref_idx on public.content_reviews (source_ref, created_at desc);
create index if not exists content_reviews_game_idx on public.content_reviews (game_id, created_at desc);
create index if not exists content_items_file_game_idx on public.content_items (game_id, status) where source = 'content_file';
drop trigger if exists content_reviews_append_only on public.content_reviews;
create trigger content_reviews_append_only before update or delete on public.content_reviews
  for each row execute function private.forbid_any();
alter table public.content_reviews enable row level security;
alter table public.content_reviews force row level security;
revoke all on public.content_reviews from anon, authenticated;
grant select, insert on public.content_reviews to service_role;
