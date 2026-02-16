import { NextResponse } from "next/server";

import { listPhotosMonthPageFromDatabase } from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PhotoMonthPageResponse } from "@/lib/gallery/types";

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

const buildEmptyMonthResponse = (year: number, month: number): PhotoMonthPageResponse => ({
  year,
  month,
  key: `${year}-${String(month).padStart(2, "0")}`,
  items: [],
  nextCursor: null,
});

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
    return NextResponse.json(buildEmptyMonthResponse(year, month), {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
      },
    });
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
      { error: "월별 사진을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
