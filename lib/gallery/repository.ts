import type { GalleryImage } from "./images";
import {
  formatMonthMetaLabel,
  formatRelativeDaysFromNow,
  formatYearMonthLabel,
} from "./time";
import type {
  HighlightResponse,
  PhotoMonthPageResponse,
  PhotoItem,
  PhotoListResponse,
  PhotoSummaryResponse,
  PhotoVisibility,
  YearMonthStat,
} from "./types";

type GalleryPhotoRow = {
  id: string;
  src: string;
  thumb_src: string | null;
  alt: string;
  caption: string;
  taken_at: string;
  updated_at: string | null;
  visibility: string | null;
  is_featured: boolean | null;
  featured_rank: number | null;
};

type GalleryPhotoSummaryRow = {
  id: string;
  taken_at: string;
  updated_at: string | null;
};

type QueryError = { message: string } | null;
type QueryResponse<T> = {
  data: T | null;
  error: QueryError;
};

type QueryPromise<T> = PromiseLike<QueryResponse<T>>;

type QueryChain = {
  select: (columns?: string) => QueryChain;
  order: (column: string, options: { ascending: boolean }) => QueryChain;
  eq: (column: string, value: unknown) => QueryChain;
  gte: (column: string, value: string) => QueryChain;
  lt: (column: string, value: string) => QueryChain;
  limit: (count: number) => QueryChain;
  insert: (values: Record<string, unknown>) => QueryChain;
  update: (values: Record<string, unknown>) => QueryChain;
  single: () => QueryPromise<unknown>;
};

type RepositoryClient = {
  from: (table: string) => unknown;
};

export type ListPhotosPageOptions = {
  cursor?: string;
  limit?: number;
  year?: number;
  month?: number;
  day?: number;
  visibility?: PhotoVisibility;
};

export type ListHighlightOptions = {
  featuredLimit?: number;
  highlightLimit?: number;
  visibility?: PhotoVisibility;
};

export type ListPhotoSummaryOptions = {
  year?: number;
  month?: number;
  day?: number;
  visibility?: PhotoVisibility;
};

export type ListPhotosMonthPageOptions = {
  year: number;
  month: number;
  cursor?: string;
  limit?: number;
  visibility?: PhotoVisibility;
};

export type CreateGalleryImageRecordInput = {
  src: string;
  thumbSrc?: string | null;
  storagePath: string;
  originalName: string;
  type: string;
  size: number;
  caption?: string;
  alt?: string;
  takenAt?: string;
  updatedAt?: string;
  visibility?: PhotoVisibility;
  isFeatured?: boolean;
  featuredRank?: number | null;
};

export type UpdateGalleryFeaturedInput = {
  photoId: string;
  isFeatured: boolean;
  featuredRank?: number | null;
};

const GALLERY_SELECT_COLUMNS =
  "id, src, thumb_src, alt, caption, taken_at, updated_at, visibility, is_featured, featured_rank";
const SUMMARY_SELECT_COLUMNS = "id, taken_at, updated_at";
const DEFAULT_PAGE_LIMIT = 36;
const MAX_PAGE_LIMIT = 96;
const DEFAULT_VISIBILITY: PhotoVisibility = "family";

const formatCaptionFromFileName = (fileName: string) => {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const normalized = withoutExt.replace(/[_-]+/g, " ").trim();

  if (normalized.length === 0) {
    return "새 사진";
  }

  return normalized;
};

const clampLimit = (limit?: number) => {
  if (typeof limit !== "number" || Number.isNaN(limit)) {
    return DEFAULT_PAGE_LIMIT;
  }

  return Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.floor(limit)));
};

const normalizeVisibility = (value: string | null | undefined): PhotoVisibility => {
  if (value === "admin") {
    return "admin";
  }

  return "family";
};

const getQueryVisibility = (visibility?: PhotoVisibility): PhotoVisibility => {
  return visibility ?? DEFAULT_VISIBILITY;
};

const parseCursor = (cursor?: string): string | null => {
  if (!cursor) {
    return null;
  }

  const [takenAt] = cursor.split("|");

  if (!takenAt) {
    return null;
  }

  const parsedDate = new Date(takenAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
};

const encodeCursor = (row: Pick<GalleryPhotoRow, "taken_at" | "id">): string => {
  return `${row.taken_at}|${row.id}`;
};

const mapRowToPhotoItem = (row: GalleryPhotoRow): PhotoItem => {
  return {
    id: row.id,
    src: row.src,
    thumbSrc: row.thumb_src ?? null,
    alt: row.alt,
    caption: row.caption,
    takenAt: row.taken_at,
    updatedAt: row.updated_at ?? row.taken_at,
    visibility: normalizeVisibility(row.visibility),
    isFeatured: Boolean(row.is_featured),
    featuredRank: row.featured_rank,
  };
};

export const mapPhotoItemToGalleryImage = (item: PhotoItem): GalleryImage => {
  return {
    id: item.id,
    src: item.src,
    thumbSrc: item.thumbSrc,
    alt: item.alt,
    caption: item.caption,
    tags: item.tags,
    takenAt: item.takenAt,
    updatedAt: item.updatedAt,
    visibility: item.visibility,
    isFeatured: item.isFeatured,
    featuredRank: item.featuredRank,
  };
};

export const mapGalleryImageToPhotoItem = (item: GalleryImage): PhotoItem => {
  return {
    id: item.id,
    src: item.src,
    thumbSrc: item.thumbSrc ?? null,
    alt: item.alt,
    caption: item.caption,
    tags: item.tags,
    takenAt: item.takenAt,
    updatedAt: item.updatedAt ?? item.takenAt,
    visibility: item.visibility ?? DEFAULT_VISIBILITY,
    isFeatured: item.isFeatured ?? false,
    featuredRank: item.featuredRank ?? null,
  };
};

const applyDateRangeFilter = (
  query: QueryChain,
  year?: number,
  month?: number,
  day?: number,
) => {
  if (!year) {
    return query;
  }

  if (month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    const fromDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const toDate = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));

    return query
      .gte("taken_at", fromDate.toISOString())
      .lt("taken_at", toDate.toISOString());
  }

  if (month && month >= 1 && month <= 12) {
    const fromDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const toDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    return query
      .gte("taken_at", fromDate.toISOString())
      .lt("taken_at", toDate.toISOString());
  }

  const fromDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const toDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));

  return query
    .gte("taken_at", fromDate.toISOString())
    .lt("taken_at", toDate.toISOString());
};

const getMonthDateRange = (year: number, month: number) => {
  const fromDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const toDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));

  return {
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
  };
};

const buildYearMonthStats = (rows: GalleryPhotoSummaryRow[]): YearMonthStat[] => {
  const map = new Map<
    string,
    {
      key: string;
      year: number;
      month: number;
      count: number;
      latestTakenAt: string;
      latestUpdatedAt: string;
    }
  >();

  for (const row of rows) {
    const date = new Date(row.taken_at);

    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const updatedAt = row.updated_at ?? row.taken_at;

    if (!map.has(key)) {
      map.set(key, {
        key,
        year,
        month,
        count: 0,
        latestTakenAt: row.taken_at,
        latestUpdatedAt: updatedAt,
      });
    }

    const target = map.get(key);

    if (!target) {
      continue;
    }

    target.count += 1;

    if (+new Date(row.taken_at) > +new Date(target.latestTakenAt)) {
      target.latestTakenAt = row.taken_at;
    }

    if (+new Date(updatedAt) > +new Date(target.latestUpdatedAt)) {
      target.latestUpdatedAt = updatedAt;
    }
  }

  return [...map.values()]
    .sort((left, right) => {
      return +new Date(right.latestTakenAt) - +new Date(left.latestTakenAt);
    })
    .map((item) => ({
      key: item.key,
      year: item.year,
      month: item.month,
      count: item.count,
      latestTakenAt: item.latestTakenAt,
      latestUpdatedAt: item.latestUpdatedAt,
      label: formatYearMonthLabel(item.year, item.month),
      updatedLabel:
        formatRelativeDaysFromNow(item.latestUpdatedAt) === "오늘"
          ? "최근 업데이트 오늘"
          : `최근 업데이트 ${formatRelativeDaysFromNow(item.latestUpdatedAt)}`,
      metaLabel: formatMonthMetaLabel(
        item.year,
        item.month,
        item.count,
        item.latestUpdatedAt,
      ),
    }));
};

export const listPhotoSummaryFromDatabase = async (
  supabase: RepositoryClient,
  options: ListPhotoSummaryOptions = {},
  tableName = getGalleryPhotosTableName(),
): Promise<PhotoSummaryResponse> => {
  const { year, month, day, visibility } = options;

  let query = supabase
    .from(tableName) as QueryChain;

  query = query
    .select(SUMMARY_SELECT_COLUMNS)
    .order("taken_at", { ascending: false });

  query = query.eq("visibility", getQueryVisibility(visibility));
  query = applyDateRangeFilter(query, year, month, day);

  const { data, error } = (await (query as unknown as QueryPromise<GalleryPhotoSummaryRow[]>)) as {
    data: GalleryPhotoSummaryRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`Failed to load photo summary: ${error.message}`);
  }

  const rows = data ?? [];

  return {
    totalCount: rows.length,
    months: buildYearMonthStats(rows),
  };
};

export const getGalleryPhotosTableName = () => {
  return process.env.GALLERY_PHOTOS_TABLE ?? "gallery_photos";
};

export const listGalleryImagesFromDatabase = async (
  supabase: RepositoryClient,
  tableName = getGalleryPhotosTableName(),
): Promise<GalleryImage[]> => {
  let query = supabase
    .from(tableName) as QueryChain;

  query = query
    .select(GALLERY_SELECT_COLUMNS)
    .order("taken_at", { ascending: false });

  query = query.eq("visibility", DEFAULT_VISIBILITY);

  const { data, error } = (await (query as unknown as QueryPromise<GalleryPhotoRow[]>)) as {
    data: GalleryPhotoRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`Failed to list gallery images: ${error.message}`);
  }

  return (data ?? []).map((row) => mapPhotoItemToGalleryImage(mapRowToPhotoItem(row)));
};

export const listPhotosPageFromDatabase = async (
  supabase: RepositoryClient,
  options: ListPhotosPageOptions = {},
  tableName = getGalleryPhotosTableName(),
): Promise<PhotoListResponse> => {
  const limit = clampLimit(options.limit);
  const queryLimit = limit + 1;
  const cursorTakenAt = parseCursor(options.cursor);

  let query = supabase
    .from(tableName) as QueryChain;

  query = query
    .select(GALLERY_SELECT_COLUMNS)
    .order("taken_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(queryLimit);

  query = query.eq("visibility", getQueryVisibility(options.visibility));

  if (cursorTakenAt) {
    query = query.lt("taken_at", cursorTakenAt);
  }

  query = applyDateRangeFilter(query, options.year, options.month, options.day);

  const { data, error } = (await (query as unknown as QueryPromise<GalleryPhotoRow[]>)) as {
    data: GalleryPhotoRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`Failed to list photos page: ${error.message}`);
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = pageRows.map(mapRowToPhotoItem);

  const summary = await listPhotoSummaryFromDatabase(supabase, {
    year: options.year,
    month: options.month,
    day: options.day,
    visibility: options.visibility,
  }, tableName);

  return {
    items,
    nextCursor: hasMore && pageRows.length > 0 ? encodeCursor(pageRows[pageRows.length - 1]) : null,
    summary: {
      totalCount: summary.totalCount,
      yearMonthStats: summary.months,
    },
  };
};

export const listPhotosMonthPageFromDatabase = async (
  supabase: RepositoryClient,
  options: ListPhotosMonthPageOptions,
  tableName = getGalleryPhotosTableName(),
): Promise<PhotoMonthPageResponse> => {
  if (
    !Number.isInteger(options.year) ||
    !Number.isInteger(options.month) ||
    options.month < 1 ||
    options.month > 12
  ) {
    throw new Error("Invalid year/month range.");
  }

  const limit = clampLimit(options.limit);
  const queryLimit = limit + 1;
  const cursorTakenAt = parseCursor(options.cursor);
  const { fromDate, toDate } = getMonthDateRange(options.year, options.month);

  let query = supabase
    .from(tableName) as QueryChain;

  query = query
    .select(GALLERY_SELECT_COLUMNS)
    .order("taken_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(queryLimit);

  query = query
    .eq("visibility", getQueryVisibility(options.visibility))
    .gte("taken_at", fromDate)
    .lt("taken_at", toDate);

  if (cursorTakenAt) {
    query = query.lt("taken_at", cursorTakenAt);
  }

  const { data, error } = (await (query as unknown as QueryPromise<GalleryPhotoRow[]>)) as {
    data: GalleryPhotoRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`Failed to list monthly photos page: ${error.message}`);
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  return {
    year: options.year,
    month: options.month,
    key: `${options.year}-${String(options.month).padStart(2, "0")}`,
    items: pageRows.map(mapRowToPhotoItem),
    nextCursor: hasMore && pageRows.length > 0 ? encodeCursor(pageRows[pageRows.length - 1]) : null,
  };
};

const getFallbackFeatured = (
  all: PhotoItem[],
  featuredLimit: number,
): PhotoItem[] => {
  const deduped = Array.from(new Map(all.map((item) => [item.id, item])).values());
  const featured = deduped
    .filter((item) => item.isFeatured)
    .sort((left, right) => {
      const rankLeft = left.featuredRank ?? Number.MAX_SAFE_INTEGER;
      const rankRight = right.featuredRank ?? Number.MAX_SAFE_INTEGER;

      if (rankLeft !== rankRight) {
        return rankLeft - rankRight;
      }

      return +new Date(right.takenAt) - +new Date(left.takenAt);
    })
    .slice(0, featuredLimit);

  if (featured.length >= featuredLimit) {
    return featured;
  }

  const featuredIds = new Set(featured.map((item) => item.id));

  const fill = deduped
    .filter((item) => !featuredIds.has(item.id))
    .sort((left, right) => +new Date(right.takenAt) - +new Date(left.takenAt))
    .slice(0, featuredLimit - featured.length);

  return [...featured, ...fill];
};

export const listPhotoHighlightsFromDatabase = async (
  supabase: RepositoryClient,
  options: ListHighlightOptions = {},
  tableName = getGalleryPhotosTableName(),
): Promise<HighlightResponse> => {
  const featuredLimit = Math.max(1, Math.min(2, Math.floor(options.featuredLimit ?? 2)));
  const highlightLimit = Math.max(1, Math.min(12, Math.floor(options.highlightLimit ?? 6)));
  const visibility = getQueryVisibility(options.visibility);

  const featuredQuery = supabase
    .from(tableName) as QueryChain;

  const featuredSelectQuery = featuredQuery
    .select(GALLERY_SELECT_COLUMNS)
    .eq("visibility", visibility)
    .eq("is_featured", true)
    .order("featured_rank", { ascending: true })
    .order("taken_at", { ascending: false })
    .limit(featuredLimit);

  const {
    data: featuredData,
    error: featuredError,
  }: { data: GalleryPhotoRow[] | null; error: { message: string } | null } = await (featuredSelectQuery as unknown as QueryPromise<GalleryPhotoRow[]>);

  if (featuredError) {
    throw new Error(`Failed to list featured photos: ${featuredError.message}`);
  }

  const latestQuery = supabase
    .from(tableName) as QueryChain;

  const latestSelectQuery = latestQuery
    .select(GALLERY_SELECT_COLUMNS)
    .eq("visibility", visibility)
    .order("taken_at", { ascending: false })
    .limit(Math.max(highlightLimit, featuredLimit) + featuredLimit + 8);

  const {
    data: latestData,
    error: latestError,
  }: { data: GalleryPhotoRow[] | null; error: { message: string } | null } = await (latestSelectQuery as unknown as QueryPromise<GalleryPhotoRow[]>);

  if (latestError) {
    throw new Error(`Failed to list latest photos: ${latestError.message}`);
  }

  const latestItems = (latestData ?? []).map(mapRowToPhotoItem);
  const featured = getFallbackFeatured(
    [...(featuredData ?? []).map(mapRowToPhotoItem), ...latestItems],
    featuredLimit,
  );
  const featuredIds = new Set(featured.map((item) => item.id));
  const highlights = latestItems.filter((item) => !featuredIds.has(item.id)).slice(0, highlightLimit);

  return {
    featured,
    highlights,
  };
};

export const createGalleryImageRecord = async (
  supabase: RepositoryClient,
  input: CreateGalleryImageRecordInput,
  tableName = getGalleryPhotosTableName(),
): Promise<PhotoItem> => {
  const caption = input.caption?.trim() || formatCaptionFromFileName(input.originalName);
  const alt = input.alt?.trim() || `${caption} 사진`;

  const { data, error }: { data: GalleryPhotoRow | null; error: { message: string } | null } =
    await ((supabase
      .from(tableName) as QueryChain)
      .insert({
        src: input.src,
        thumb_src: input.thumbSrc ?? null,
        storage_path: input.storagePath,
        original_name: input.originalName,
        type: input.type,
        size: input.size,
        caption,
        alt,
        taken_at: input.takenAt ?? new Date().toISOString(),
        updated_at: input.updatedAt ?? new Date().toISOString(),
        visibility: input.visibility ?? DEFAULT_VISIBILITY,
        is_featured: input.isFeatured ?? false,
        featured_rank: input.featuredRank ?? null,
      })
      .select(GALLERY_SELECT_COLUMNS)
      .single() as QueryPromise<GalleryPhotoRow>);

  if (error) {
    throw new Error(`Failed to create gallery image record: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to create gallery image record: no data returned");
  }

  return mapRowToPhotoItem(data);
};

export const updateGalleryPhotoFeatured = async (
  supabase: RepositoryClient,
  input: UpdateGalleryFeaturedInput,
  tableName = getGalleryPhotosTableName(),
): Promise<PhotoItem> => {
  const { data, error }: { data: GalleryPhotoRow | null; error: { message: string } | null } =
    await ((supabase
      .from(tableName) as QueryChain)
      .update({
        is_featured: input.isFeatured,
        featured_rank: input.isFeatured ? input.featuredRank ?? null : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.photoId)
      .select(GALLERY_SELECT_COLUMNS)
      .single() as QueryPromise<GalleryPhotoRow>);

  if (error) {
    throw new Error(`Failed to update featured photo: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to update featured photo: no data returned");
  }

  return mapRowToPhotoItem(data);
};
