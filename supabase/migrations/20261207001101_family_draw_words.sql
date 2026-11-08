-- Round 3 item 11: Family Draw words in the database. The 16+ Draw It word list (party mode 'drawfam') moves from
-- code (lib/party-adult/family.ts FAMILY_DRAW_WORDS) into public.family_draw_words, so the admin Content page
-- ("Family Draw words" tab) can add, edit, retire, import and export words. The round setup reads the active words
-- at runtime (lib/party-adult/family-words.ts); the code list stays only as the fallback while the table holds no
-- active words (or fewer than the four a round needs).
--
-- What this adds:
--   public.family_draw_words  one row per word: the word, its other names (alt), list order (sort), retired_at /
--                             retired_by (a retired word is never dealt; it stays for the record and can come back),
--                             who added and last changed it. Words stay all-ages-safe: lower-case letters and single
--                             spaces, 2 to 30 characters, at most six other names (checked here and, with the party
--                             text filter's word list, in the API).
--   seed                      the current code list (103 words, in order), so nothing changes for players.
-- Server only: RLS enabled and forced, no grants to anon or authenticated; the API writes with the service role and
-- writes the audit log (drawword.*). No existing table changes.
--
-- Rollback (one transaction; the round setup falls back to the code list):
--   drop table if exists public.family_draw_words;
--   delete from supabase_migrations.schema_migrations where version = '20261207001101';

create table if not exists public.family_draw_words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique check (char_length(word) between 2 and 30 and word ~ '^[a-z]+( [a-z]+)*$'),
  alt text[] not null default '{}' check (
    cardinality(alt) <= 6
    and char_length(array_to_string(alt, '|')) <= 190
    and array_to_string(alt, '|') ~ '^([a-z]+( [a-z]+)*(\|[a-z]+( [a-z]+)*)*)?$'
  ),
  sort integer not null default 0,
  retired_at timestamptz,
  retired_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists family_draw_words_active_idx on public.family_draw_words (sort) where retired_at is null;
alter table public.family_draw_words enable row level security;
alter table public.family_draw_words force row level security;
revoke all on public.family_draw_words from anon, authenticated;
grant all on public.family_draw_words to service_role;

insert into public.family_draw_words (word, alt, sort) values
  ('banku', '{}'::text[], 1),
  ('kenkey', array['dokon'], 2),
  ('jollof', array['jollof rice'], 3),
  ('fufu', '{}'::text[], 4),
  ('kelewele', '{}'::text[], 5),
  ('waakye', '{}'::text[], 6),
  ('plantain', array['kokoo', 'plantains'], 7),
  ('groundnut', array['peanut', 'groundnuts', 'peanuts'], 8),
  ('kente', array['kente cloth'], 9),
  ('trotro', array['tro tro'], 10),
  ('okada', array['motorbike', 'motorcycle'], 11),
  ('talking drum', array['drum'], 12),
  ('adinkra', array['adinkra symbol'], 13),
  ('cocoa pod', array['cocoa', 'cacao'], 14),
  ('coconut', '{}'::text[], 15),
  ('mango', '{}'::text[], 16),
  ('pineapple', '{}'::text[], 17),
  ('yam', '{}'::text[], 18),
  ('cassava', '{}'::text[], 19),
  ('pepper', array['chilli', 'chili', 'pepper fruit'], 20),
  ('coal pot', array['charcoal pot', 'coalpot'], 21),
  ('fan ice', array['fanice', 'ice cream'], 22),
  ('sachet water', array['pure water', 'water sachet'], 23),
  ('black star', array['star'], 24),
  ('football', array['soccer ball', 'ball'], 25),
  ('goalkeeper', array['keeper', 'goalie'], 26),
  ('market', '{}'::text[], 27),
  ('canoe', array['boat'], 28),
  ('lighthouse', '{}'::text[], 29),
  ('castle', array['fort'], 30),
  ('harmattan', array['dust'], 31),
  ('umbrella', '{}'::text[], 32),
  ('head pan', array['headpan', 'basin'], 33),
  ('broom', '{}'::text[], 34),
  ('chalkboard', array['blackboard'], 35),
  ('school bag', array['backpack', 'bag'], 36),
  ('uniform', '{}'::text[], 37),
  ('palm tree', array['palm'], 38),
  ('baobab', array['tree'], 39),
  ('lizard', array['agama'], 40),
  ('goat', '{}'::text[], 41),
  ('chicken', array['hen', 'fowl'], 42),
  ('guinea fowl', '{}'::text[], 43),
  ('phone', array['mobile phone', 'cellphone'], 44),
  ('television', array['tv'], 45),
  ('radio', '{}'::text[], 46),
  ('bicycle', array['bike'], 47),
  ('bus', '{}'::text[], 48),
  ('aeroplane', array['airplane', 'plane'], 49),
  ('rocket', '{}'::text[], 50),
  ('bridge', '{}'::text[], 51),
  ('house', array['home'], 52),
  ('door', '{}'::text[], 53),
  ('window', '{}'::text[], 54),
  ('ladder', '{}'::text[], 55),
  ('key', '{}'::text[], 56),
  ('clock', '{}'::text[], 57),
  ('glasses', array['spectacles'], 58),
  ('hat', array['cap'], 59),
  ('shoe', array['shoes', 'sneaker'], 60),
  ('slippers', array['flip flops', 'charlie wote', 'chale wote'], 61),
  ('candle', '{}'::text[], 62),
  ('lamp', array['light bulb', 'bulb'], 63),
  ('book', '{}'::text[], 64),
  ('pencil', array['pen'], 65),
  ('scissors', '{}'::text[], 66),
  ('guitar', '{}'::text[], 67),
  ('piano', array['keyboard'], 68),
  ('camera', '{}'::text[], 69),
  ('kite', '{}'::text[], 70),
  ('balloon', '{}'::text[], 71),
  ('birthday cake', array['cake'], 72),
  ('cup', array['mug'], 73),
  ('spoon', '{}'::text[], 74),
  ('bread', '{}'::text[], 75),
  ('egg', '{}'::text[], 76),
  ('banana', '{}'::text[], 77),
  ('orange', '{}'::text[], 78),
  ('watermelon', '{}'::text[], 79),
  ('rain', array['raining'], 80),
  ('rainbow', '{}'::text[], 81),
  ('sun', array['sunshine'], 82),
  ('moon', '{}'::text[], 83),
  ('cloud', '{}'::text[], 84),
  ('mountain', array['hill'], 85),
  ('river', '{}'::text[], 86),
  ('beach', array['seaside', 'sea'], 87),
  ('fish', '{}'::text[], 88),
  ('crab', '{}'::text[], 89),
  ('turtle', array['tortoise'], 90),
  ('elephant', '{}'::text[], 91),
  ('lion', '{}'::text[], 92),
  ('giraffe', '{}'::text[], 93),
  ('monkey', '{}'::text[], 94),
  ('snail', '{}'::text[], 95),
  ('butterfly', '{}'::text[], 96),
  ('spider', '{}'::text[], 97),
  ('dog', array['puppy'], 98),
  ('cat', array['kitten'], 99),
  ('robot', '{}'::text[], 100),
  ('crown', '{}'::text[], 101),
  ('snowman', '{}'::text[], 102),
  ('tent', '{}'::text[], 103)
on conflict (word) do nothing;
