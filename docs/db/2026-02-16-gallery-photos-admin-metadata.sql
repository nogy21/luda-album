-- 2026-02-16
-- gallery_photos 확장 스키마 + 기존 레코드 백필

alter table if exists public.gallery_photos
  add column if not exists src text,
  add column if not exists thumb_src text,
  add column if not exists original_name text,
  add column if not exists type text,
  add column if not exists size bigint,
  add column if not exists caption text,
  add column if not exists alt text,
  add column if not exists updated_at timestamptz,
  add column if not exists visibility text,
  add column if not exists is_featured boolean,
  add column if not exists featured_rank integer;

update public.gallery_photos
set caption = coalesce(
  nullif(
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(coalesce(storage_path, ''), '^.*/', ''),
            '\.[^.]+$',
            ''
          ),
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-',
          '',
          'i'
        ),
        '[_-]+',
        ' ',
        'g'
      )
    ),
    ''
  ),
  '새 사진'
)
where caption is null or trim(caption) = '';

update public.gallery_photos
set alt = coalesce(
  nullif(trim(alt), ''),
  concat(coalesce(nullif(trim(caption), ''), '새 사진'), ' 사진')
)
where alt is null or trim(alt) = '';

update public.gallery_photos
set updated_at = coalesce(updated_at, created_at, taken_at, now())
where updated_at is null;

update public.gallery_photos
set visibility = coalesce(nullif(trim(visibility), ''), 'family')
where visibility is null or trim(visibility) = '';

update public.gallery_photos
set is_featured = coalesce(is_featured, false)
where is_featured is null;

update public.gallery_photos
set month_key = to_char(coalesce(taken_at, created_at, now()) at time zone 'UTC', 'YYYY-MM')
where month_key is null or trim(month_key) = '';

alter table if exists public.gallery_photos
  alter column visibility set default 'family',
  alter column is_featured set default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gallery_photos_visibility_chk'
  ) then
    alter table public.gallery_photos
      add constraint gallery_photos_visibility_chk
      check (visibility in ('family', 'admin'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gallery_photos_size_non_negative_chk'
  ) then
    alter table public.gallery_photos
      add constraint gallery_photos_size_non_negative_chk
      check (size is null or size >= 0);
  end if;
end $$;

create index if not exists gallery_photos_taken_at_id_desc_idx
  on public.gallery_photos (taken_at desc, id desc);

create index if not exists gallery_photos_visibility_taken_at_desc_idx
  on public.gallery_photos (visibility, taken_at desc);

create index if not exists gallery_photos_featured_rank_taken_at_desc_idx
  on public.gallery_photos (is_featured, featured_rank, taken_at desc);
