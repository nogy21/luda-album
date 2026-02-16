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
  thumb_src text,
  storage_path text not null unique,
  original_name text not null,
  type text not null,
  size bigint not null check (size >= 0),
  caption text not null default '새 사진',
  alt text not null default '새 사진',
  taken_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  visibility text not null default 'family' check (visibility in ('family', 'admin')),
  is_featured boolean not null default false,
  featured_rank integer,
  month_key text,
  created_at timestamptz not null default now()
);

create index if not exists gallery_photos_taken_at_desc_idx
  on public.gallery_photos (taken_at desc);

create index if not exists gallery_photos_taken_at_id_desc_idx
  on public.gallery_photos (taken_at desc, id desc);

create index if not exists gallery_photos_visibility_taken_at_desc_idx
  on public.gallery_photos (visibility, taken_at desc);

create index if not exists gallery_photos_featured_rank_taken_at_desc_idx
  on public.gallery_photos (is_featured, featured_rank, taken_at desc);

create table if not exists public.gallery_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);

create table if not exists public.gallery_photo_events (
  photo_id uuid not null references public.gallery_photos(id) on delete cascade,
  event_id uuid not null references public.gallery_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, event_id)
);

create index if not exists gallery_photo_events_event_id_idx
  on public.gallery_photo_events (event_id);

create index if not exists gallery_photo_events_photo_id_idx
  on public.gallery_photo_events (photo_id);

create table if not exists public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.gallery_photos(id) on delete cascade,
  nickname text not null default '익명의 팬',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists photo_comments_photo_id_created_at_desc_idx
  on public.photo_comments (photo_id, created_at desc);

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  is_active boolean not null default true,
  last_notified_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists web_push_subscriptions_updated_at_desc_idx
  on public.web_push_subscriptions (updated_at desc);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
