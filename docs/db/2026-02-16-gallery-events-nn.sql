-- 2026-02-16
-- gallery events N:N 모델 + 캡션 해시태그 백필

create extension if not exists "pgcrypto";

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

with hashtag_candidates as (
  select
    photos.id as photo_id,
    trim(regexp_replace(match[1], '\s+', ' ', 'g')) as name,
    lower(trim(regexp_replace(match[1], '\s+', ' ', 'g'))) as normalized_name
  from public.gallery_photos as photos
  cross join lateral regexp_matches(
    coalesce(photos.caption, ''),
    '#([[:alnum:]_가-힣-]+)',
    'g'
  ) as match
),
normalized_candidates as (
  select distinct
    photo_id,
    name,
    normalized_name
  from hashtag_candidates
  where normalized_name <> ''
)
insert into public.gallery_events (name, normalized_name)
select
  min(name) as name,
  normalized_name
from normalized_candidates
group by normalized_name
on conflict (normalized_name) do update
set
  name = excluded.name,
  updated_at = now();

with hashtag_candidates as (
  select
    photos.id as photo_id,
    lower(trim(regexp_replace(match[1], '\s+', ' ', 'g'))) as normalized_name
  from public.gallery_photos as photos
  cross join lateral regexp_matches(
    coalesce(photos.caption, ''),
    '#([[:alnum:]_가-힣-]+)',
    'g'
  ) as match
),
normalized_candidates as (
  select distinct
    photo_id,
    normalized_name
  from hashtag_candidates
  where normalized_name <> ''
)
insert into public.gallery_photo_events (photo_id, event_id)
select
  candidate.photo_id,
  events.id
from normalized_candidates as candidate
join public.gallery_events as events
  on events.normalized_name = candidate.normalized_name
on conflict (photo_id, event_id) do nothing;
