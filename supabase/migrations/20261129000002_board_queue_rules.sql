-- Board Bay "Play live" for Ludo: the house rules a player picked before searching (e.g. 'back,side'; '' for
-- standard). Only players with the same rules are paired, and the match starts with them.
alter table public.board_queue add column if not exists rules text not null default '';
-- Rollback: alter table public.board_queue drop column if exists rules;
