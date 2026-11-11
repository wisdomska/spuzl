-- Game state (owner request, 11 Nov 2026): an admin turns each game On, In testing or Off from the Games page, and
-- chooses whether it can be played in Duels and Parties.
--
-- games.status gains 'testing' and 'off' (it already holds 'live', 'coming_soon', 'hidden' and 'retired'):
--   'live'    On: everyone can find and play it (as before);
--   'testing' In testing: only signed-in admins can open it, to try it out; players never see it and the server
--             refuses it like an unknown game;
--   'off'     Off: hidden from everyone and refused for everyone.
-- Retired games stay 'retired' (they are retired in code, lib/catalog RETIRED_IDS). The app reads the state with the
-- game settings (cached 30 s per server instance) and every server gate checks it (lib/game/service assertGameOpen).
-- What else reads games.status: daily_rollover's missing-Dailies count and the live-ops gap alert (status = 'live',
-- so a game In testing or Off gets no Daily and raises no gap alert, which is right), admin_clears_by_game and the
-- games_read policy (status <> 'hidden', so the rows stay readable for old results and names).
--
-- The lab switch moves into the state: a row still in the old lab status ('coming_soon') becomes 'live' when the
-- setting "features.labGames" has it, otherwise 'testing' (none today: every lab game graduated in 20261211300101),
-- and the "features.labGames" row in game_settings goes, as the app no longer reads it (the Games page owns it).
--
-- games.versus: "Can be played in Duels and Parties" (default yes). The admin can keep a race game out of Duels and
-- Parties; the pickers hide it and room creation refuses it. Only the service role writes it (the admin API).
--
-- RLS stays forced on games; no client grant changes (clients may only read the rows, as before).
--
-- Rollback (puts the games In testing or Off back to their nearest old status; the setting row is restored empty):
--   update public.games set status = 'coming_soon' where status = 'testing';
--   update public.games set status = 'hidden' where status = 'off';
--   alter table public.games drop column if exists versus;
--   alter table public.games drop constraint games_status_check;
--   alter table public.games add constraint games_status_check
--     check (status in ('live', 'coming_soon', 'hidden', 'retired'));
--   insert into public.game_settings (key, value) values ('features.labGames', '[]'::jsonb) on conflict (key) do nothing;
--   delete from supabase_migrations.schema_migrations where version = '20261212010101';

alter table public.games drop constraint if exists games_status_check;
alter table public.games
  add constraint games_status_check check (status in ('live', 'testing', 'off', 'coming_soon', 'hidden', 'retired'));

alter table public.games add column if not exists versus boolean not null default true;
comment on column public.games.status is
  'live = On (everyone), testing = In testing (signed-in admins only), off = Off (nobody), retired = retired in code; coming_soon and hidden are older values read as testing and off';
comment on column public.games.versus is 'Can be played in Duels and Parties (admin Games page); false keeps it out of the pickers and rooms';

-- The old lab switch, moved into the state.
update public.games g
set status = case
  when exists (
    select 1
    from public.game_settings s, jsonb_array_elements_text(case when jsonb_typeof(s.value) = 'array' then s.value else '[]'::jsonb end) as v(id)
    where s.key = 'features.labGames' and v.id = g.id
  ) then 'live'
  else 'testing'
end
where g.status = 'coming_soon';

delete from public.game_settings where key = 'features.labGames';

alter table public.games enable row level security;
alter table public.games force row level security;
