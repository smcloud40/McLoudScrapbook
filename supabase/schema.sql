-- Run this in the Supabase SQL editor once your project is created.
-- It sets up the full data model discussed: packs, credits (FIFO, row-per-credit),
-- ownership, and scrapbooks/pages/elements.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_subscriber boolean not null default false,
  subscription_renewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists packs (
  id text primary key,              -- e.g. 'bg-autumn'
  category text not null check (category in ('background','sticker','font')),
  name text not null,
  price_cents integer not null,
  is_free boolean not null default false,
  is_seasonal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists elements (
  id text primary key,              -- e.g. 's4'
  pack_id text not null references packs(id) on delete cascade,
  kind text not null check (kind in ('image','font')),
  asset_url text,                   -- storage URL for images
  font_label text,                  -- sample text for font elements
  created_at timestamptz not null default now()
);

create table if not exists user_owned_packs (
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null references packs(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  purchase_type text not null check (purchase_type in ('cash','credit')),
  primary key (user_id, pack_id)
);

create table if not exists credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 months'),
  redeemed_at timestamptz
);

create table if not exists scrapbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'My scrapbook',
  created_at timestamptz not null default now()
);

create table if not exists scrapbook_pages (
  id uuid primary key default gen_random_uuid(),
  scrapbook_id uuid not null references scrapbooks(id) on delete cascade,
  page_number integer not null
);

create table if not exists scrapbook_elements (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references scrapbook_pages(id) on delete cascade,
  element_id text not null references elements(id),
  x real not null,
  y real not null,
  w real not null,
  h real not null,
  layer_order integer not null default 0
);

-- Row Level Security: everyone can read the catalog, users only touch their own data.
alter table profiles enable row level security;
alter table user_owned_packs enable row level security;
alter table credits enable row level security;
alter table scrapbooks enable row level security;
alter table scrapbook_pages enable row level security;
alter table scrapbook_elements enable row level security;

create policy "own profile" on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

create policy "own owned packs" on user_owned_packs for select using (auth.uid() = user_id);
create policy "own credits" on credits for select using (auth.uid() = user_id);

create policy "own scrapbooks" on scrapbooks for all using (auth.uid() = user_id);
create policy "own pages" on scrapbook_pages for all using (
  exists (select 1 from scrapbooks s where s.id = scrapbook_id and s.user_id = auth.uid())
);
create policy "own elements placed" on scrapbook_elements for all using (
  exists (
    select 1 from scrapbook_pages p join scrapbooks s on s.id = p.scrapbook_id
    where p.id = page_id and s.user_id = auth.uid()
  )
);

-- packs/elements are public read (no RLS needed, or add a permissive policy):
alter table packs enable row level security;
alter table elements enable row level security;
create policy "public read packs" on packs for select using (true);
create policy "public read elements" on elements for select using (true);
