import { NextResponse } from "next/server";

import { listPhotoSummaryFromDatabase } from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PhotoSummaryResponse } from "@/lib/gallery/types";

const buildEmptySummary = (): PhotoSummaryResponse => ({
  totalCount: 0,
  months: [],
});

export async function GET() {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(buildEmptySummary(), {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
      },
    });
  }

  try {
    const response = await listPhotoSummaryFromDatabase(
      supabase,
      { visibility: "family" },
    );

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "요약 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
