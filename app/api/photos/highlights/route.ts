import { NextResponse } from "next/server";

import { listPhotoHighlightsFromDatabase } from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { HighlightResponse } from "@/lib/gallery/types";

const buildEmptyHighlights = (): HighlightResponse => ({
  featured: [],
  highlights: [],
});

export async function GET() {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(buildEmptyHighlights(), {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
      },
    });
  }

  try {
    const response = await listPhotoHighlightsFromDatabase(supabase, {
      featuredLimit: 2,
      highlightLimit: 6,
      visibility: "family",
    });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "하이라이트 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
