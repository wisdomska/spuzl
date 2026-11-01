-- Seasonal events (Phase 5, admin setting "features.seasonal").
-- public.events: admin-managed time windows with a Home banner (copy + accent token) and one bonus quest
-- (goal JSON, validated by the API against lib/events/index.ts). Written only through /api/admin/events with
-- the service role (audited there); clients never read it directly, so the feature switch is enforced by the
-- API (GET /api/v1/events/current, /api/v1/quests).
-- public.event_progress: each player's progress on an event's bonus quest, advanced by free-play clears through
-- public.svc_event_progress (atomic increment, capped at the target). Players may read their own rows.
-- Rollback:
--   drop function if exists public.svc_event_progress(uuid, uuid, integer, integer);
--   drop table if exists public.event_progress;
--   drop table if exists public.events;
--   delete from supabase_migrations.schema_migrations where version = '20261109600001';

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- design token name (styles/spuzl-tokens.css); the list is fixed here and in lib/events/index.ts
  accent text not null check (accent in ('accent', 'gold', 'freeze', 'w-logic', 'w-line', 'w-shape', 'w-number',
    'w-word', 'w-clue', 'w-reflex', 'w-rage', 'w-board')),
  banner text not null check (char_length(banner) between 2 and 140),
  -- {title, kind: free_clears|world_clears|no_hint_clears, n, world?, xp, sparks}
  quest jsonb not null check (jsonb_typeof(quest) = 'object'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_window_check check (ends_at > starts_at and ends_at - starts_at <= interval '62 days')
);
-- Active-event lookup: starts_at <= now() < ends_at, latest start wins.
create index if not exists events_window_idx on public.events (starts_at desc, ends_at);
create index if not exists events_created_by_idx on public.events (created_by);

alter table public.events enable row level security;
alter table public.events force row level security;
revoke all on public.events from anon, authenticated;

create table if not exists public.event_progress (
  player_id uuid not null references public.players (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  target integer not null check (target > 0),
  completed_at timestamptz,
  claimed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (player_id, event_id)
);
create index if not exists event_progress_event_idx on public.event_progress (event_id);

alter table public.event_progress enable row level security;
alter table public.event_progress force row level security;
revoke all on public.event_progress from anon, authenticated;
grant select on public.event_progress to authenticated;
drop policy if exists event_progress_own on public.event_progress;
create policy event_progress_own on public.event_progress for select to authenticated
  using (player_id = (select auth.uid()));

-- Adds p_delta to a player's event quest progress, capped at p_target; sets completed_at once.
-- Returns the new progress and whether this call completed the quest. Service role only.
create or replace function public.svc_event_progress(p_player uuid, p_event uuid, p_delta integer, p_target integer)
returns table (progress integer, completed boolean)
language plpgsql security definer set search_path = '' as $$
declare was_done boolean;
begin
  if p_delta <= 0 or p_target <= 0 then raise exception 'delta and target must be positive'; end if;
  select ep.completed_at is not null into was_done
    from public.event_progress ep where ep.player_id = p_player and ep.event_id = p_event for update;
  insert into public.event_progress as ep (player_id, event_id, progress, target, completed_at)
    values (p_player, p_event, least(p_delta, p_target), p_target, case when p_delta >= p_target then now() end)
  on conflict (player_id, event_id) do update
    set progress = case when ep.completed_at is not null then ep.progress else least(ep.progress + p_delta, p_target) end,
        target = case when ep.completed_at is not null then ep.target else p_target end,
        completed_at = coalesce(ep.completed_at, case when ep.progress + p_delta >= p_target then now() end),
        updated_at = now()
  returning ep.progress, (ep.completed_at is not null and not coalesce(was_done, false)) into progress, completed;
  return next;
end $$;

revoke execute on function public.svc_event_progress(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.svc_event_progress(uuid, uuid, integer, integer) to service_role;
