import { NextResponse } from "next/server";

import { groupGalleryImagesByMonth } from "@/lib/gallery/grouping";
import { galleryImages } from "@/lib/gallery/images";
import {
  listPhotosPageFromDatabase,
  mapGalleryImageToPhotoItem,
  mapPhotoItemToGalleryImage,
} from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PhotoItem, PhotoListResponse, YearMonthStat } from "@/lib/gallery/types";

const DEFAULT_LIMIT = 36;
const MAX_LIMIT = 96;

const parseIntegerParam = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
};

const clampLimit = (value?: number) => {
  if (typeof value !== "number") {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, value));
};

const parseCursorTakenAt = (cursor?: string) => {
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

const buildYearMonthStats = (items: PhotoItem[]): YearMonthStat[] => {
  const grouped = groupGalleryImagesByMonth(items.map(mapPhotoItemToGalleryImage));

  return grouped.map((group) => ({
    key: group.key,
    year: group.year,
    month: group.month,
    count: group.items.length,
    latestTakenAt: group.latestTakenAt,
    latestUpdatedAt: group.latestUpdatedAt,
    label: group.label,
    updatedLabel: group.updatedLabel,
    metaLabel: group.metaLabel,
  }));
};

const applyDateFilter = (
  items: PhotoItem[],
  year?: number,
  month?: number,
  day?: number,
) => {
  if (!year) {
    return items;
  }

  return items.filter((item) => {
    const date = new Date(item.takenAt);
    const itemYear = date.getUTCFullYear();
    const itemMonth = date.getUTCMonth() + 1;

    if (month && day) {
      return itemYear === year && itemMonth === month && date.getUTCDate() === day;
    }

    if (month) {
      return itemYear === year && itemMonth === month;
    }

    return itemYear === year;
  });
};

const buildStaticResponse = ({
  cursor,
  limit,
  year,
  month,
  day,
}: {
  cursor?: string;
  limit: number;
  year?: number;
  month?: number;
  day?: number;
}): PhotoListResponse => {
  const allItems = galleryImages
    .map(mapGalleryImageToPhotoItem)
    .filter((item) => item.visibility === "family")
    .sort((left, right) => +new Date(right.takenAt) - +new Date(left.takenAt));
  const filtered = applyDateFilter(allItems, year, month, day);
  const cursorTakenAt = parseCursorTakenAt(cursor);

  const cursorFiltered = cursorTakenAt
    ? filtered.filter((item) => +new Date(item.takenAt) < +new Date(cursorTakenAt))
    : filtered;

  const pageItems = cursorFiltered.slice(0, limit);
  const hasMore = cursorFiltered.length > limit;
  const nextCursor =
    hasMore && pageItems.length > 0
      ? `${pageItems[pageItems.length - 1].takenAt}|${pageItems[pageItems.length - 1].id}`
      : null;

  return {
    items: pageItems,
    nextCursor,
    summary: {
      totalCount: filtered.length,
      yearMonthStats: buildYearMonthStats(filtered),
    },
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const limitParam = parseIntegerParam(searchParams.get("limit"));
  const yearParam = parseIntegerParam(searchParams.get("year"));
  const monthParam = parseIntegerParam(searchParams.get("month"));
  const dayParam = parseIntegerParam(searchParams.get("day"));

  if (limitParam === null || yearParam === null || monthParam === null || dayParam === null) {
    return NextResponse.json(
      { error: "잘못된 쿼리 파라미터입니다." },
      { status: 400 },
    );
  }

  const limit = clampLimit(limitParam);
  const year = yearParam;
  const month = monthParam;
  const day = dayParam;

  if (month && (!year || month < 1 || month > 12)) {
    return NextResponse.json(
      { error: "month 파라미터는 1~12 범위이며 year와 함께 전달해야 합니다." },
      { status: 400 },
    );
  }

  if (day && (!year || !month || day < 1 || day > 31)) {
    return NextResponse.json(
      { error: "day 파라미터는 year, month와 함께 전달해야 합니다." },
      { status: 400 },
    );
  }

  const cursor = searchParams.get("cursor") ?? undefined;
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    const fallback = buildStaticResponse({ cursor, limit, year, month, day });

    return NextResponse.json(fallback, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
      },
    });
  }

  try {
    const response = await listPhotosPageFromDatabase(supabase, {
      cursor,
      limit,
        year,
        month,
        day,
        visibility: "family",
      });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
      },
    });
  } catch {
    const fallback = buildStaticResponse({ cursor, limit, year, month, day });

    return NextResponse.json(fallback, {
      headers: {
        "Cache-Control": "s-maxage=30, stale-while-revalidate=300",
      },
    });
  }
}
