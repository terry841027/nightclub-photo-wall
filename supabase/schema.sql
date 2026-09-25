-- Run this once in the Supabase project's SQL editor.

create extension if not exists pgcrypto;

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  image_url text not null,
  caption text,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  source text not null default 'guest' check (source in ('guest', 'staff')),
  sort_order double precision not null default extract(epoch from clock_timestamp()),
  created_at timestamptz not null default now()
);

create index if not exists photos_status_created_at_idx on photos (status, created_at desc);
create index if not exists photos_sort_order_idx on photos (sort_order);

create table if not exists settings (
  key text primary key,
  value text not null
);

insert into settings (key, value)
values ('require_approval', 'true')
on conflict (key) do nothing;

-- RLS is enabled with no policies attached, which denies all access to the
-- anon/authenticated roles. Only the service role key (used server-side only,
-- inside the Next.js API routes) can read or write these tables.
alter table photos enable row level security;
alter table settings enable row level security;

-- After running this file, also create a Storage bucket named "photos"
-- (Storage -> New bucket) and mark it as a public bucket, so uploaded
-- images can be served directly to the display screen and admin page.
