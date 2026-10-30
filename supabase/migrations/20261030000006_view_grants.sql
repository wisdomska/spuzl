-- Supabase default privileges grant writes on new relations; the public projection view is read-only.
revoke insert, update, delete, truncate on public.player_cards from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;
