import { NextResponse } from "next/server";

import { listE2EFixturePhotosPage } from "@/lib/gallery/e2e-fixtures";
import { listPhotosPageFromDatabase } from "@/lib/gallery/repository";
import type { PostTimelineResponse } from "@/lib/gallery/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isE2EFixtureModeEnabled } from "@/lib/testing/e2e-fixture-mode";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 10;

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

const buildEmptyResponse = (): PostTimelineResponse => ({
  items: [],
  nextCursor: null,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = parseIntegerParam(searchParams.get("limit"));

  if (limitParam === null) {
    return NextResponse.json(
      { error: "잘못된 쿼리 파라미터입니다." },
      { status: 400 },
    );
  }

  const limit = clampLimit(limitParam);
  const cursor = searchParams.get("cursor") ?? undefined;
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    const payload = isE2EFixtureModeEnabled()
      ? listE2EFixturePhotosPage({ cursor, limit })
      : buildEmptyResponse();

    return NextResponse.json(
      {
        items: payload.items,
        nextCursor: payload.nextCursor,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
        },
      },
    );
  }

  try {
    const response = await listPhotosPageFromDatabase(supabase, {
      cursor,
      limit,
      visibility: "family",
    });

    return NextResponse.json(
      {
        items: response.items,
        nextCursor: response.nextCursor,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "타임라인 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
