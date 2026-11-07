-- R2-P5 part B: Family Draw, Draw It for 16+ (party_mode 'drawfam', admin setting "party.familyDraw", off by default).
-- Signed-in players aged 16 and over only; the app server enforces that on every call (lib/party-adult/family.ts,
-- requireFamilyDraw in lib/multiplayer/server/adult.ts). Under-16s never see or join it (docs/DECISIONS.md PD1).
--
-- What this adds:
--   matches.party_mode        also takes 'drawfam' (the room-kind constraint matches_adult_party_room already covers
--                             it: a race-kind room, no classroom, no puzzle game)
--   party_rounds.options      a 16+ round's four preset words (the secret word among them); a family round is a
--                             'draw' round with options, so svc_party_strokes and the stroke caps apply unchanged
--   party_guesses.pick        a 16+ guesser's pick (index into options); null for typed 18+ guesses. One pick per
--                             player per round (party_guesses_pick_once). A pick stores no text.
-- RLS stays enabled and forced on both tables, with no client policies or grants (server only), as before. Reports
-- from these rooms use the existing party report path (target_type 'party', snapshot from the server's copy).
-- Nothing here changes existing rows.
--
-- Rollback (one transaction):
--   delete from public.matches where party_mode = 'drawfam';
--   drop index if exists public.party_guesses_pick_once;
--   alter table public.party_guesses drop column if exists pick;
--   alter table public.party_rounds drop column if exists options;
--   alter table public.matches drop constraint if exists matches_party_mode_check;
--   alter table public.matches add constraint matches_party_mode_check check (party_mode in ('race', 'draw', 'truths'));
--   delete from supabase_migrations.schema_migrations where version = '20261205005401';

alter table public.matches drop constraint if exists matches_party_mode_check;
alter table public.matches add constraint matches_party_mode_check check (party_mode in ('race', 'draw', 'truths', 'drawfam'));

alter table public.party_rounds add column if not exists options text[]
  check (options is null or (cardinality(options) = 4 and char_length(array_to_string(options, '')) <= 160));

alter table public.party_guesses add column if not exists pick smallint check (pick is null or pick between 0 and 3);
create unique index if not exists party_guesses_pick_once
  on public.party_guesses (match_id, set_no, round, player_id) where pick is not null;
