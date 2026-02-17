import type {
  PhotoItem,
  PhotoListResponse,
  PhotoMonthPageResponse,
  PhotoSummaryResponse,
  YearMonthStat,
} from "./types";

const DEFAULT_PAGE_LIMIT = 36;
const DEFAULT_MONTH_LIMIT = 24;
const MAX_LIMIT = 96;

const FIXTURE_PHOTOS: PhotoItem[] = [
  {
    id: "fixture-08",
    src: "/20260208_173840.jpg",
    thumbSrc: "/20260208_173840.jpg",
    alt: "루다 크리스마스 모자 사진",
    caption: "루다 크리스마스 #8",
    eventNames: ["크리스마스"],
    takenAt: "2026-02-16T08:00:00.000Z",
    updatedAt: "2026-02-16T08:00:00.000Z",
    visibility: "family",
    isFeatured: true,
    featuredRank: 1,
  },
  {
    id: "fixture-07",
    src: "/20260208_173841.jpg",
    thumbSrc: "/20260208_173841.jpg",
    alt: "루다 선물 상자와 함께",
    caption: "루다 크리스마스 #7",
    eventNames: ["크리스마스"],
    takenAt: "2026-02-15T08:00:00.000Z",
    updatedAt: "2026-02-15T08:00:00.000Z",
    visibility: "family",
    isFeatured: true,
    featuredRank: 2,
  },
  {
    id: "fixture-06",
    src: "/20260208_173842.jpg",
    thumbSrc: "/20260208_173842.jpg",
    alt: "루다 하얀 배경 촬영",
    caption: "루다 데일리 #6",
    eventNames: ["일상"],
    takenAt: "2026-02-14T08:00:00.000Z",
    updatedAt: "2026-02-14T08:00:00.000Z",
    visibility: "family",
    isFeatured: false,
    featuredRank: null,
  },
  {
    id: "fixture-05",
    src: "/20260208_173843.jpg",
    thumbSrc: "/20260208_173843.jpg",
    alt: "루다 웃는 얼굴",
    caption: "루다 데일리 #5",
    eventNames: ["일상"],
    takenAt: "2026-02-12T08:00:00.000Z",
    updatedAt: "2026-02-12T08:00:00.000Z",
    visibility: "family",
    isFeatured: false,
    featuredRank: null,
  },
  {
    id: "fixture-04",
    src: "/20260208_173853.jpg",
    thumbSrc: "/20260208_173853.jpg",
    alt: "루다 겨울 촬영",
    caption: "겨울 앨범 #4",
    eventNames: ["겨울"],
    takenAt: "2026-01-31T08:00:00.000Z",
    updatedAt: "2026-01-31T08:00:00.000Z",
    visibility: "family",
    isFeatured: false,
    featuredRank: null,
  },
  {
    id: "fixture-03",
    src: "/20260208_153542.jpg",
    thumbSrc: "/20260208_153542.jpg",
    alt: "루다 겨울 스냅",
    caption: "겨울 앨범 #3",
    eventNames: ["겨울"],
    takenAt: "2026-01-20T08:00:00.000Z",
    updatedAt: "2026-01-20T08:00:00.000Z",
    visibility: "family",
    isFeatured: false,
    featuredRank: null,
  },
  {
    id: "fixture-02",
    src: "/luda.jpg",
    thumbSrc: "/luda.jpg",
    alt: "루다 연말 사진",
    caption: "연말 루다 #2",
    eventNames: ["연말"],
    takenAt: "2025-12-25T08:00:00.000Z",
    updatedAt: "2025-12-25T08:00:00.000Z",
    visibility: "family",
    isFeatured: false,
    featuredRank: null,
  },
  {
    id: "fixture-01",
    src: "/luda.jpg",
    thumbSrc: "/luda.jpg",
    alt: "루다 연말 사진 두번째",
    caption: "연말 루다 #1",
    eventNames: ["연말"],
    takenAt: "2025-12-10T08:00:00.000Z",
    updatedAt: "2025-12-10T08:00:00.000Z",
    visibility: "family",
    isFeatured: false,
    featuredRank: null,
  },
];

FIXTURE_PHOTOS.sort((left, right) => {
  const byTakenAt = +new Date(right.takenAt) - +new Date(left.takenAt);

  if (byTakenAt !== 0) {
    return byTakenAt;
  }

  return right.id.localeCompare(left.id);
});

const clampLimit = (value: number | undefined, fallback: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value)));
};

const encodeCursor = (item: PhotoItem) => `${item.takenAt}|${item.id}`;

const parseCursor = (cursor: string | undefined) => {
  if (!cursor) {
    return null;
  }

  const splitIndex = cursor.lastIndexOf("|");

  if (splitIndex <= 0) {
    return null;
  }

  const takenAt = cursor.slice(0, splitIndex);
  const id = cursor.slice(splitIndex + 1);

  if (!takenAt || !id) {
    return null;
  }

  return { takenAt, id };
};

const compareDescByCursor = (left: PhotoItem, right: { takenAt: string; id: string }) => {
  if (left.takenAt > right.takenAt) {
    return -1;
  }

  if (left.takenAt < right.takenAt) {
    return 1;
  }

  if (left.id > right.id) {
    return -1;
  }

  if (left.id < right.id) {
    return 1;
  }

  return 0;
};

const filterByCursor = (items: PhotoItem[], cursor: string | undefined) => {
  const parsedCursor = parseCursor(cursor);

  if (!parsedCursor) {
    return items;
  }

  return items.filter((item) => compareDescByCursor(item, parsedCursor) > 0);
};

const filterByDate = (
  items: PhotoItem[],
  year?: number,
  month?: number,
  day?: number,
) => {
  return items.filter((item) => {
    const date = new Date(item.takenAt);
    const itemYear = date.getUTCFullYear();
    const itemMonth = date.getUTCMonth() + 1;
    const itemDay = date.getUTCDate();

    if (year && itemYear !== year) {
      return false;
    }

    if (month && itemMonth !== month) {
      return false;
    }

    if (day && itemDay !== day) {
      return false;
    }

    return true;
  });
};

const paginate = (items: PhotoItem[], limit: number) => {
  const pageItems = items.slice(0, limit);
  const hasMore = items.length > limit;

  return {
    items: pageItems,
    nextCursor: hasMore && pageItems.length > 0 ? encodeCursor(pageItems[pageItems.length - 1]) : null,
  };
};

const buildSummary = (items: PhotoItem[]): PhotoSummaryResponse => {
  const summaryByMonth = new Map<string, YearMonthStat>();

  for (const item of items) {
    const date = new Date(item.takenAt);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const label = `${year}년 ${month}월`;

    const current = summaryByMonth.get(key);

    if (!current) {
      summaryByMonth.set(key, {
        key,
        year,
        month,
        count: 1,
        latestTakenAt: item.takenAt,
        latestUpdatedAt: item.updatedAt,
        label,
        updatedLabel: label,
        metaLabel: "총 1장",
      });
      continue;
    }

    const latestTakenAt =
      +new Date(item.takenAt) > +new Date(current.latestTakenAt) ? item.takenAt : current.latestTakenAt;
    const latestUpdatedAt =
      +new Date(item.updatedAt) > +new Date(current.latestUpdatedAt)
        ? item.updatedAt
        : current.latestUpdatedAt;
    const count = current.count + 1;

    summaryByMonth.set(key, {
      ...current,
      count,
      latestTakenAt,
      latestUpdatedAt,
      metaLabel: `총 ${count}장`,
    });
  }

  const months = [...summaryByMonth.values()].sort(
    (left, right) => +new Date(right.latestTakenAt) - +new Date(left.latestTakenAt),
  );

  return {
    totalCount: items.length,
    months,
  };
};

export const getE2EFixturePhotos = () => {
  return FIXTURE_PHOTOS;
};

export const getE2EFixturePhotoSummary = () => {
  return buildSummary(FIXTURE_PHOTOS);
};

export const listE2EFixturePhotosPage = (options: {
  cursor?: string;
  limit?: number;
  year?: number;
  month?: number;
  day?: number;
}): PhotoListResponse => {
  const filtered = filterByDate(FIXTURE_PHOTOS, options.year, options.month, options.day);
  const withCursor = filterByCursor(filtered, options.cursor);
  const limit = clampLimit(options.limit, DEFAULT_PAGE_LIMIT);
  const page = paginate(withCursor, limit);
  const summary = buildSummary(filtered);

  return {
    items: page.items,
    nextCursor: page.nextCursor,
    summary: {
      totalCount: summary.totalCount,
      yearMonthStats: summary.months,
    },
  };
};

export const listE2EFixtureMonthPage = (options: {
  year: number;
  month: number;
  cursor?: string;
  limit?: number;
}): PhotoMonthPageResponse => {
  const limit = clampLimit(options.limit, DEFAULT_MONTH_LIMIT);
  const key = `${options.year}-${String(options.month).padStart(2, "0")}`;
  const filteredByMonth = filterByDate(FIXTURE_PHOTOS, options.year, options.month);
  const withCursor = filterByCursor(filteredByMonth, options.cursor);
  const page = paginate(withCursor, limit);

  return {
    year: options.year,
    month: options.month,
    key,
    items: page.items,
    nextCursor: page.nextCursor,
  };
};
