create extension if not exists "pgcrypto";

create table if not exists public.guestbook (
  id uuid primary key default gen_random_uuid(),
  nickname text not null default '익명의 팬',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists guestbook_created_at_desc_idx
  on public.guestbook (created_at desc);

create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  src text not null,
  storage_path text not null unique,
  original_name text not null,
  type text not null,
  size bigint not null check (size >= 0),
  caption text not null,
  alt text not null,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists gallery_photos_taken_at_desc_idx
  on public.gallery_photos (taken_at desc);
