import type { GalleryImage } from "./images";
import {
  listEventNamesByPhotoIds,
  replacePhotoEvents,
} from "./events-repository";
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
  src?: string;
  thumb_src?: string | null;
  alt?: string;
  caption?: string;
  storage_path?: string | null;
  taken_at: string;
  updated_at?: string | null;
  created_at?: string | null;
  visibility?: string | null;
  is_featured?: boolean | null;
  featured_rank?: number | null;
  month_key?: string | null;
};

type GalleryPhotoSummaryRow = {
  id: string;
  taken_at: string;
  updated_at?: string | null;
  created_at?: string | null;
};

type GalleryPhotoSummaryRpcRow = {
  key: string;
  year: number;
  month: number;
  count: number;
  latest_taken_at: string;
  latest_updated_at: string;
};

type QueryError = {
  message: string;
  code?: string | null;
} | null;
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
  delete: () => QueryChain;
  single: () => QueryPromise<unknown>;
};

type RepositoryClient = {
  from: (table: string) => unknown;
  rpc?: (
    fn: string,
    params?: Record<string, unknown>,
  ) => PromiseLike<QueryResponse<unknown>>;
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

export type ListAdminPhotosPageOptions = {
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
  eventNames?: string[];
};

export type UpdateGalleryFeaturedInput = {
  photoId: string;
  isFeatured: boolean;
  featuredRank?: number | null;
};

export type UpdateGalleryMetadataInput = {
  photoId: string;
  caption?: string;
  takenAt?: string;
  isFeatured?: boolean;
  featuredRank?: number | null;
  eventNames?: string[];
};

export type DeleteGalleryPhotoRecordInput = {
  photoId: string;
};

const GALLERY_SELECT_COLUMNS =
  "id, src, thumb_src, alt, caption, taken_at, updated_at, visibility, is_featured, featured_rank";
const SUMMARY_SELECT_COLUMNS = "id, taken_at, updated_at";
const DEFAULT_PAGE_LIMIT = 36;
const MAX_PAGE_LIMIT = 96;
const MAX_CAPTION_LENGTH = 120;
const DEFAULT_VISIBILITY: PhotoVisibility = "family";
const DEFAULT_STORAGE_BUCKET = "luda-photos";

const formatCaptionFromFileName = (fileName: string) => {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const normalized = withoutExt.replace(/[_-]+/g, " ").trim();

  if (normalized.length === 0) {
    return "새 사진";
  }

  return normalized;
};

const getFileNameFromPath = (path: string) => {
  const normalized = path.split("?")[0] ?? path;
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? normalized;
};

const toMonthKey = (isoString: string) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const buildStoragePublicUrl = (storagePath?: string | null) => {
  if (!storagePath) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? DEFAULT_STORAGE_BUCKET;
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
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

const mapRowToPhotoItem = (
  row: GalleryPhotoRow,
  eventNames: string[] = [],
): PhotoItem => {
  const srcFromColumn = typeof row.src === "string" ? row.src.trim() : "";
  const resolvedSrc = srcFromColumn || buildStoragePublicUrl(row.storage_path) || "";
  const captionSource = row.caption
    ? row.caption
    : formatCaptionFromFileName(getFileNameFromPath(row.storage_path ?? row.id));
  const altSource = row.alt ?? `${captionSource} 사진`;

  return {
    id: row.id,
    src: resolvedSrc,
    thumbSrc: row.thumb_src === undefined ? (resolvedSrc || null) : row.thumb_src,
    alt: altSource,
    caption: captionSource,
    eventNames,
    takenAt: row.taken_at,
    updatedAt: row.updated_at ?? row.created_at ?? row.taken_at,
    visibility: normalizeVisibility(row.visibility),
    isFeatured: Boolean(row.is_featured),
    featuredRank: row.featured_rank ?? null,
  };
};

export const mapPhotoItemToGalleryImage = (item: PhotoItem): GalleryImage => {
  const tags = item.tags ?? (item.eventNames.length > 0 ? item.eventNames : undefined);

  return {
    id: item.id,
    src: item.src,
    thumbSrc: item.thumbSrc,
    alt: item.alt,
    caption: item.caption,
    ...(tags ? { tags } : {}),
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
    eventNames: item.tags ?? [],
    tags: item.tags,
    takenAt: item.takenAt,
    updatedAt: item.updatedAt ?? item.takenAt,
    visibility: item.visibility ?? DEFAULT_VISIBILITY,
    isFeatured: item.isFeatured ?? false,
    featuredRank: item.featuredRank ?? null,
  };
};

const mapRowsToPhotoItems = async (
  supabase: RepositoryClient,
  rows: GalleryPhotoRow[],
) => {
  if (rows.length === 0) {
    return [];
  }

  let eventNamesByPhotoId = new Map<string, string[]>();

  try {
    eventNamesByPhotoId = await listEventNamesByPhotoIds(
      supabase,
      rows.map((row) => row.id),
    );
  } catch {
    // Keep photo listing resilient even if event relation query fails.
  }

  return rows.map((row) => mapRowToPhotoItem(row, eventNamesByPhotoId.get(row.id) ?? []));
};

const getDateRangeFilterBounds = (
  year?: number,
  month?: number,
  day?: number,
) => {
  if (!year) {
    return { fromDate: undefined, toDate: undefined };
  }

  if (month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    const fromDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const toDate = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));

    return { fromDate: fromDate.toISOString(), toDate: toDate.toISOString() };
  }

  if (month && month >= 1 && month <= 12) {
    const fromDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const toDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    return { fromDate: fromDate.toISOString(), toDate: toDate.toISOString() };
  }

  const fromDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const toDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));

  return { fromDate: fromDate.toISOString(), toDate: toDate.toISOString() };
};

const applyDateRangeFilter = (
  query: QueryChain,
  year?: number,
  month?: number,
  day?: number,
) => {
  const { fromDate, toDate } = getDateRangeFilterBounds(year, month, day);

  if (!fromDate || !toDate) {
    return query;
  }

  return query.gte("taken_at", fromDate).lt("taken_at", toDate);
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
    const updatedAt = row.updated_at ?? row.created_at ?? row.taken_at;

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

const mapSummaryRpcRowsToStats = (
  rows: GalleryPhotoSummaryRpcRow[],
): YearMonthStat[] => {
  return [...rows]
    .sort((left, right) => {
      return +new Date(right.latest_taken_at) - +new Date(left.latest_taken_at);
    })
    .map((row) => ({
      key: row.key,
      year: row.year,
      month: row.month,
      count: row.count,
      latestTakenAt: row.latest_taken_at,
      latestUpdatedAt: row.latest_updated_at,
      label: formatYearMonthLabel(row.year, row.month),
      updatedLabel:
        formatRelativeDaysFromNow(row.latest_updated_at) === "오늘"
          ? "최근 업데이트 오늘"
          : `최근 업데이트 ${formatRelativeDaysFromNow(row.latest_updated_at)}`,
      metaLabel: formatMonthMetaLabel(
        row.year,
        row.month,
        row.count,
        row.latest_updated_at,
      ),
    }));
};

const isMissingPhotoSummaryRpcError = (error: QueryError) => {
  if (!error) {
    return false;
  }

  if (error.code === "42883") {
    return true;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("gallery_photo_summary_by_month") &&
    (message.includes("does not exist") || message.includes("not found"))
  );
};

const listPhotoSummaryFromRpc = async (
  supabase: RepositoryClient,
  options: ListPhotoSummaryOptions,
) => {
  if (typeof supabase.rpc !== "function") {
    return null;
  }

  const { fromDate, toDate } = getDateRangeFilterBounds(
    options.year,
    options.month,
    options.day,
  );
  const { data, error }: {
    data: GalleryPhotoSummaryRpcRow[] | null;
    error: QueryError;
  } = await (supabase.rpc("gallery_photo_summary_by_month", {
    p_visibility: getQueryVisibility(options.visibility),
    p_from: fromDate ?? null,
    p_to: toDate ?? null,
  }) as QueryPromise<GalleryPhotoSummaryRpcRow[]>);

  if (error) {
    if (isMissingPhotoSummaryRpcError(error)) {
      return null;
    }

    throw new Error(`Failed to load photo summary RPC: ${error.message}`);
  }

  const rows = data ?? [];

  return {
    totalCount: rows.reduce((sum, row) => sum + row.count, 0),
    months: mapSummaryRpcRowsToStats(rows),
  };
};

export const listPhotoSummaryFromDatabase = async (
  supabase: RepositoryClient,
  options: ListPhotoSummaryOptions = {},
  tableName = getGalleryPhotosTableName(),
): Promise<PhotoSummaryResponse> => {
  if (tableName === getGalleryPhotosTableName()) {
    const rpcResult = await listPhotoSummaryFromRpc(supabase, options);

    if (rpcResult) {
      return rpcResult;
    }
  }

  const { year, month, day, visibility } = options;
  let query = supabase
    .from(tableName) as QueryChain;

  query = query
    .select(SUMMARY_SELECT_COLUMNS)
    .order("taken_at", { ascending: false })
    .eq("visibility", getQueryVisibility(visibility));

  query = applyDateRangeFilter(query, year, month, day);

  const { data, error }: { data: GalleryPhotoSummaryRow[] | null; error: { message: string } | null } =
    await (query as unknown as QueryPromise<GalleryPhotoSummaryRow[]>);

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
  const query = ((supabase
    .from(tableName) as QueryChain)
    .select(GALLERY_SELECT_COLUMNS)
    .eq("visibility", DEFAULT_VISIBILITY)
    .order("taken_at", { ascending: false })) as unknown as QueryPromise<GalleryPhotoRow[]>;
  const { data, error }: { data: GalleryPhotoRow[] | null; error: { message: string } | null } =
    await query;

  if (error) {
    throw new Error(`Failed to list gallery images: ${error.message}`);
  }

  const items = await mapRowsToPhotoItems(supabase, data ?? []);

  return items.map((item) => mapPhotoItemToGalleryImage(item));
};

export const listPhotosPageFromDatabase = async (
  supabase: RepositoryClient,
  options: ListPhotosPageOptions = {},
  tableName = getGalleryPhotosTableName(),
): Promise<PhotoListResponse> => {
  const limit = clampLimit(options.limit);
  const queryLimit = limit + 1;
  const cursorTakenAt = parseCursor(options.cursor);
  let query = (supabase
    .from(tableName) as QueryChain)
    .select(GALLERY_SELECT_COLUMNS)
    .order("taken_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(queryLimit)
    .eq("visibility", getQueryVisibility(options.visibility));

  if (cursorTakenAt) {
    query = query.lt("taken_at", cursorTakenAt);
  }

  query = applyDateRangeFilter(query, options.year, options.month, options.day);

  const { data, error }: { data: GalleryPhotoRow[] | null; error: { message: string } | null } =
    await (query as unknown as QueryPromise<GalleryPhotoRow[]>);

  if (error) {
    throw new Error(`Failed to list photos page: ${error.message}`);
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const summary = await listPhotoSummaryFromDatabase(supabase, {
    year: options.year,
    month: options.month,
    day: options.day,
    visibility: options.visibility,
  }, tableName);
  const items = await mapRowsToPhotoItems(supabase, pageRows);

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
  let query = (supabase
    .from(tableName) as QueryChain)
    .select(GALLERY_SELECT_COLUMNS)
    .order("taken_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(queryLimit)
    .eq("visibility", getQueryVisibility(options.visibility))
    .gte("taken_at", fromDate)
    .lt("taken_at", toDate);

  if (cursorTakenAt) {
    query = query.lt("taken_at", cursorTakenAt);
  }

  const { data, error }: { data: GalleryPhotoRow[] | null; error: { message: string } | null } =
    await (query as unknown as QueryPromise<GalleryPhotoRow[]>);

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
    items: await mapRowsToPhotoItems(supabase, pageRows),
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

  const latestLimit = Math.max(highlightLimit, featuredLimit) + featuredLimit + 8;
  const featuredSelectQuery = (supabase
    .from(tableName) as QueryChain)
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

  const latestQuery = ((supabase
    .from(tableName) as QueryChain)
    .select(GALLERY_SELECT_COLUMNS)
    .eq("visibility", visibility)
    .order("taken_at", { ascending: false })
    .limit(latestLimit)) as unknown as QueryPromise<GalleryPhotoRow[]>;
  const { data: latestData, error: latestError } = await latestQuery;

  if (latestError) {
    throw new Error(`Failed to list latest photos: ${latestError.message}`);
  }

  const featuredRows = featuredData ?? [];
  const latestRows = latestData ?? [];
  const allRows = [...featuredRows, ...latestRows];
  let eventNamesByPhotoId = new Map<string, string[]>();

  if (allRows.length > 0) {
    try {
      eventNamesByPhotoId = await listEventNamesByPhotoIds(
        supabase,
        allRows.map((row) => row.id),
      );
    } catch {
      // Ignore event join failures for highlights to keep feed available.
    }
  }

  const latestItems = latestRows.map((row) =>
    mapRowToPhotoItem(row, eventNamesByPhotoId.get(row.id) ?? []),
  );
  const featured = getFallbackFeatured(
    [
      ...featuredRows.map((row) =>
        mapRowToPhotoItem(row, eventNamesByPhotoId.get(row.id) ?? []),
      ),
      ...latestItems,
    ],
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
  const takenAt = input.takenAt ?? new Date().toISOString();
  const updatedAt = input.updatedAt ?? takenAt;
  const visibility = input.visibility ?? DEFAULT_VISIBILITY;
  const monthKey = toMonthKey(takenAt);

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
        taken_at: takenAt,
        month_key: monthKey,
        updated_at: updatedAt,
        visibility,
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

  const eventNames =
    input.eventNames !== undefined
      ? await replacePhotoEvents(supabase, data.id, input.eventNames)
      : [];

  return mapRowToPhotoItem(data, eventNames);
};

export const updateGalleryPhotoFeatured = async (
  supabase: RepositoryClient,
  input: UpdateGalleryFeaturedInput,
  tableName = getGalleryPhotosTableName(),
): Promise<PhotoItem> => {
  return updateGalleryPhotoMetadata(
    supabase,
    {
      photoId: input.photoId,
      isFeatured: input.isFeatured,
      featuredRank: input.featuredRank ?? null,
    },
    tableName,
  );
};

export const listAdminPhotosPageFromDatabase = async (
  supabase: RepositoryClient,
  options: ListAdminPhotosPageOptions = {},
  tableName = getGalleryPhotosTableName(),
) => {
  const limit = clampLimit(options.limit);
  const queryLimit = limit + 1;
  const cursorTakenAt = parseCursor(options.cursor);
  let query = (supabase
    .from(tableName) as QueryChain)
    .select(GALLERY_SELECT_COLUMNS)
    .order("taken_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(queryLimit);

  if (options.visibility) {
    query = query.eq("visibility", options.visibility);
  }

  if (cursorTakenAt) {
    query = query.lt("taken_at", cursorTakenAt);
  }

  const { data, error }: { data: GalleryPhotoRow[] | null; error: { message: string } | null } =
    await (query as unknown as QueryPromise<GalleryPhotoRow[]>);

  if (error) {
    throw new Error(`Failed to list admin photos page: ${error.message}`);
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: await mapRowsToPhotoItems(supabase, pageRows),
    nextCursor: hasMore && pageRows.length > 0 ? encodeCursor(pageRows[pageRows.length - 1]) : null,
  };
};

export const updateGalleryPhotoMetadata = async (
  supabase: RepositoryClient,
  input: UpdateGalleryMetadataInput,
  tableName = getGalleryPhotosTableName(),
): Promise<PhotoItem> => {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const hasEventNamesUpdate = input.eventNames !== undefined;

  if (input.caption !== undefined) {
    const trimmed = input.caption.trim();
    if (!trimmed) {
      throw new Error("caption은 비워둘 수 없어요.");
    }
    if (trimmed.length > MAX_CAPTION_LENGTH) {
      throw new Error(`caption은 ${MAX_CAPTION_LENGTH}자 이하여야 해요.`);
    }
    updates.caption = trimmed;
    updates.alt = `${trimmed} 사진`;
  }

  if (input.takenAt !== undefined) {
    const parsed = new Date(input.takenAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("takenAt 형식이 올바르지 않아요.");
    }
    const takenAt = parsed.toISOString();
    updates.taken_at = takenAt;
    updates.month_key = toMonthKey(takenAt);
  }

  if (input.isFeatured !== undefined) {
    updates.is_featured = input.isFeatured;
    updates.featured_rank = input.isFeatured ? input.featuredRank ?? null : null;
  } else if (input.featuredRank !== undefined) {
    updates.featured_rank = input.featuredRank;
  }

  if (Object.keys(updates).length === 1 && !hasEventNamesUpdate) {
    throw new Error("수정할 필드를 최소 하나 이상 전달해 주세요.");
  }

  const { data, error }: { data: GalleryPhotoRow | null; error: { message: string } | null } =
    await ((supabase
      .from(tableName) as QueryChain)
      .update(updates)
      .eq("id", input.photoId)
      .select(GALLERY_SELECT_COLUMNS)
      .single() as QueryPromise<GalleryPhotoRow>);

  if (error) {
    throw new Error(`Failed to update photo metadata: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to update photo metadata: no data returned");
  }

  let eventNames: string[] = [];

  if (hasEventNamesUpdate) {
    eventNames = await replacePhotoEvents(supabase, data.id, input.eventNames ?? []);
  } else {
    try {
      eventNames = (await listEventNamesByPhotoIds(supabase, [data.id])).get(data.id) ?? [];
    } catch {
      eventNames = [];
    }
  }

  return mapRowToPhotoItem(data, eventNames);
};

export const deleteGalleryPhotoRecord = async (
  supabase: RepositoryClient,
  input: DeleteGalleryPhotoRecordInput,
  tableName = getGalleryPhotosTableName(),
) => {
  const { data, error }: {
    data: Pick<GalleryPhotoRow, "id" | "storage_path"> | null;
    error: { message: string } | null;
  } = await ((supabase
    .from(tableName) as QueryChain)
    .delete()
    .eq("id", input.photoId)
    .select("id, storage_path")
    .single() as QueryPromise<Pick<GalleryPhotoRow, "id" | "storage_path">>);

  if (error) {
    throw new Error(`Failed to delete gallery photo: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to delete gallery photo: no data returned");
  }

  return {
    id: data.id,
    storagePath: data.storage_path ?? null,
  };
};
