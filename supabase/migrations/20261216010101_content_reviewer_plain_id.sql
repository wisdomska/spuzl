-- An admin who approved a question could not delete their account (found 23 Nov 2026 clearing test admins):
-- deleting them set content_items.reviewer_id to null, and an approved or scheduled item must name its reviewer
-- (content_items_approved_has_reviewer), so the whole delete failed.
--
-- The reviewer is kept as a plain id with no foreign key, the same as the item's author and content_reviews
-- (20261215010101): the approved question stays in the game, still naming who approved it, after that person leaves.
--
-- Rollback (only once no item names a deleted account):
--   alter table public.content_items add constraint content_items_reviewer_id_fkey
--     foreign key (reviewer_id) references auth.users (id) on delete set null;
--   delete from supabase_migrations.schema_migrations where version = '20261216010101';

alter table public.content_items drop constraint if exists content_items_reviewer_id_fkey;
