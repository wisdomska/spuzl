-- R2-P5: big-screen spectator view for Party rooms (/party/<code>/tv, admin setting "features.partyTv").
-- public.matches.tv_open: the host lets anyone holding the room code watch on a TV or projector, read only
-- (nicknames and scores; no chat, no puzzle, no city or level). New rooms set it from the classroom switch (on
-- for classroom rooms, off otherwise); the host changes it with POST /api/v1/rooms/<code>/tv. Existing rooms keep
-- it off. The API enforces it (GET /api/v1/rooms/<code>/tv answers 403 while it is off); clients never read
-- matches directly for this, so no grant or policy changes.
-- Rollback:
--   alter table public.matches drop column if exists tv_open;
--   delete from supabase_migrations.schema_migrations where version = '20261204000301';

alter table public.matches add column if not exists tv_open boolean not null default false;
