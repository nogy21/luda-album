create extension if not exists "pgcrypto";

create table if not exists public.guestbook (
  id uuid primary key default gen_random_uuid(),
  nickname text not null default '익명의 팬',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists guestbook_created_at_desc_idx
  on public.guestbook (created_at desc);
