-- R4-02: feedback, the way SPIL does it. The /contact form (signed in or signed out) posts to /api/v1/feedback,
-- which stores one row here with the service role; the admin console's Feedback page lists, marks and exports them
-- (roles feedback.read / feedback.write, every change and export audited).
--
-- What this adds:
--   public.feedback   one row per message: kind (bug, puzzle, idea, other), the message (10 to 2000 characters),
--                     the email only if the sender chose to leave one for a reply, the sender's age band (never the
--                     birth month or year), the page path it was sent from, the user agent (at most 200
--                     characters), status (new, read, done), who handled it and when, created_at.
--                     player_id is the sender's player when signed in, else null.
-- Account deletion: player_id references players on delete CASCADE, so deleting an account deletes that player's
-- feedback rows entirely (message and any email with them); signed-out messages carry no player and stay until
-- handled. Players get their own rows in the account data export.
-- Server only: RLS enabled and forced, no grants to anon or authenticated. No existing table changes.
--
-- Rollback (one transaction):
--   drop table if exists public.feedback;
--   delete from supabase_migrations.schema_migrations where version = '20261209000201';

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players (id) on delete cascade,
  kind text not null default 'other' check (kind in ('bug', 'puzzle', 'idea', 'other')),
  message text not null check (char_length(message) between 10 and 2000),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+$')),
  age_band text check (age_band is null or age_band in ('13-15', '16-17', '18+')),
  from_path text check (from_path is null or (char_length(from_path) <= 200 and from_path ~ '^/' and from_path !~ '^//')),
  user_agent text check (user_agent is null or char_length(user_agent) <= 200),
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_player_idx on public.feedback (player_id) where player_id is not null;

alter table public.feedback enable row level security;
alter table public.feedback force row level security;
revoke all on public.feedback from anon, authenticated;
grant all on public.feedback to service_role;

comment on table public.feedback is
  'R4-02: messages from the /contact feedback form. Server only (service role); deleted with the player (cascade).';
