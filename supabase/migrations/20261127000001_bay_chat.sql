-- Chat in Board Games matches too (Chess, Draughts, Oware, Ludo, Four Up against people). match_messages rows now
-- belong to either a Duel/Party match (match_id) or a board game (bay_id), never both. Same filter, same 16+ rule
-- for typing, same 7-day prune; written only by the server.
--
-- Rollback:
--   delete from public.match_messages where bay_id is not null;
--   alter table public.match_messages drop constraint if exists match_messages_one_room;
--   drop index if exists public.match_messages_bay_idx;
--   alter table public.match_messages drop column if exists bay_id;
--   alter table public.match_messages alter column match_id set not null;
--   delete from supabase_migrations.schema_migrations where version = '20261127000001';

alter table public.match_messages alter column match_id drop not null;
alter table public.match_messages add column if not exists bay_id uuid references public.board_matches (id) on delete cascade;
alter table public.match_messages drop constraint if exists match_messages_one_room;
alter table public.match_messages add constraint match_messages_one_room check (num_nonnulls(match_id, bay_id) = 1);
create index if not exists match_messages_bay_idx on public.match_messages (bay_id, id) where bay_id is not null;
