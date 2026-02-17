-- 월별 사진 요약 RPC + 집계 보조 인덱스

create index if not exists gallery_photos_visibility_month_key_taken_at_desc_idx
  on public.gallery_photos (visibility, month_key, taken_at desc);

create or replace function public.gallery_photo_summary_by_month(
  p_visibility text default 'family',
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  key text,
  year integer,
  month integer,
  count integer,
  latest_taken_at timestamptz,
  latest_updated_at timestamptz
)
language sql
stable
as $$
  with filtered as (
    select
      taken_at,
      coalesce(updated_at, created_at, taken_at) as row_updated_at,
      to_char(taken_at at time zone 'UTC', 'YYYY-MM') as month_key
    from public.gallery_photos
    where visibility = coalesce(nullif(trim(p_visibility), ''), 'family')
      and (p_from is null or taken_at >= p_from)
      and (p_to is null or taken_at < p_to)
  )
  select
    month_key as key,
    split_part(month_key, '-', 1)::integer as year,
    split_part(month_key, '-', 2)::integer as month,
    count(*)::integer as count,
    max(taken_at) as latest_taken_at,
    max(row_updated_at) as latest_updated_at
  from filtered
  group by month_key
  order by max(taken_at) desc;
$$;
