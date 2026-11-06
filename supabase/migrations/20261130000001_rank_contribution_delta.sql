-- Show players how a Duel or Party moved their rank: each counted round keeps the category it moved and by how much.
--
-- Rollback:
--   alter table public.rank_contributions drop column if exists track, drop column if exists delta;
--   delete from supabase_migrations.schema_migrations where version = '20261130000001';
alter table public.rank_contributions add column if not exists track text;
alter table public.rank_contributions add column if not exists delta numeric(8, 2);
