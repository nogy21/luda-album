import { NextResponse } from "next/server";

import { galleryImages } from "@/lib/gallery/images";
import {
  listPhotosMonthPageFromDatabase,
  mapGalleryImageToPhotoItem,
} from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PhotoItem, PhotoMonthPageResponse } from "@/lib/gallery/types";

const DEFAULT_LIMIT = 24;
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

const sortByTakenAtDesc = (left: PhotoItem, right: PhotoItem) => {
  return +new Date(right.takenAt) - +new Date(left.takenAt);
};

const buildStaticMonthResponse = ({
  year,
  month,
  cursor,
  limit,
}: {
  year: number;
  month: number;
  cursor?: string;
  limit: number;
}): PhotoMonthPageResponse => {
  const allItems = galleryImages
    .map(mapGalleryImageToPhotoItem)
    .filter((item) => item.visibility === "family")
    .filter((item) => {
      const date = new Date(item.takenAt);
      return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month;
    })
    .sort(sortByTakenAtDesc);
  const cursorTakenAt = parseCursorTakenAt(cursor);

  const cursorFiltered = cursorTakenAt
    ? allItems.filter((item) => +new Date(item.takenAt) < +new Date(cursorTakenAt))
    : allItems;

  const pageItems = cursorFiltered.slice(0, limit);
  const hasMore = cursorFiltered.length > limit;
  const nextCursor =
    hasMore && pageItems.length > 0
      ? `${pageItems[pageItems.length - 1].takenAt}|${pageItems[pageItems.length - 1].id}`
      : null;

  return {
    year,
    month,
    key: `${year}-${String(month).padStart(2, "0")}`,
    items: pageItems,
    nextCursor,
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearParam = parseIntegerParam(searchParams.get("year"));
  const monthParam = parseIntegerParam(searchParams.get("month"));
  const limitParam = parseIntegerParam(searchParams.get("limit"));

  if (yearParam === null || monthParam === null || limitParam === null) {
    return NextResponse.json(
      { error: "잘못된 쿼리 파라미터입니다." },
      { status: 400 },
    );
  }

  const year = yearParam;
  const month = monthParam;

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json(
      { error: "year와 month(1~12)는 필수입니다." },
      { status: 400 },
    );
  }

  const limit = clampLimit(limitParam);
  const cursor = searchParams.get("cursor") ?? undefined;
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      buildStaticMonthResponse({ year, month, cursor, limit }),
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
        },
      },
    );
  }

  try {
    const response = await listPhotosMonthPageFromDatabase(
      supabase,
      {
        year,
        month,
        cursor,
        limit,
        visibility: "family",
      },
    );

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json(
      buildStaticMonthResponse({ year, month, cursor, limit }),
      {
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=300",
        },
      },
    );
  }
}
