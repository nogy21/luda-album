import { NextResponse } from "next/server";

import { listE2EFixturePhotosPage } from "@/lib/gallery/e2e-fixtures";
import { listPhotosPageFromDatabase } from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isE2EFixtureModeEnabled } from "@/lib/testing/e2e-fixture-mode";
import type { PhotoListResponse } from "@/lib/gallery/types";

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

const buildEmptyResponse = (): PhotoListResponse => ({
  items: [],
  nextCursor: null,
  summary: {
    totalCount: 0,
    yearMonthStats: [],
  },
});

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
    const payload = isE2EFixtureModeEnabled()
      ? listE2EFixturePhotosPage({ cursor, limit, year, month, day })
      : buildEmptyResponse();

    return NextResponse.json(payload, {
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
    return NextResponse.json(
      { error: "사진 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
