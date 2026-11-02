-- Quickfire answers stay on the server (games/quickfire/logic.ts): stored boards drop the sealed answer key
-- they used to ship for instant feedback, and their string key ("d<day>" or "f<seed>") becomes the content
-- reference the generator now writes ({ game, i, d }), which the server swaps for an opaque token when it
-- serves the board. Free play keys map to 1000000000 + seed (FREE_BASE). Idempotent: only string refs change.
update public.puzzles
set data = (data - 'sealed') || jsonb_build_object(
  'ref',
  jsonb_build_object(
    'game', 'quickfire',
    'i', case
      when data ->> 'ref' ~ '^d[0-9]{1,9}$' then substr(data ->> 'ref', 2)::bigint
      when data ->> 'ref' ~ '^f[0-9]{1,9}$' then 1000000000 + substr(data ->> 'ref', 2)::bigint
      else 0
    end,
    'd', difficulty
  )
)
where game_id = 'quickfire' and jsonb_typeof(data -> 'ref') = 'string';
