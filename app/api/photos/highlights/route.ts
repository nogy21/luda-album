import { NextResponse } from "next/server";

import { galleryImages } from "@/lib/gallery/images";
import {
  listPhotoHighlightsFromDatabase,
  mapGalleryImageToPhotoItem,
} from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { HighlightResponse, PhotoItem } from "@/lib/gallery/types";

const sortByTakenAtDesc = (left: PhotoItem, right: PhotoItem) => {
  return +new Date(right.takenAt) - +new Date(left.takenAt);
};

const getStaticHighlights = (): HighlightResponse => {
  const all = galleryImages
    .map(mapGalleryImageToPhotoItem)
    .filter((item) => item.visibility === "family")
    .sort(sortByTakenAtDesc);

  const featured = all
    .filter((item) => item.isFeatured)
    .sort((left, right) => {
      const leftRank = left.featuredRank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = right.featuredRank ?? Number.MAX_SAFE_INTEGER;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return sortByTakenAtDesc(left, right);
    })
    .slice(0, 2);

  const featuredIds = new Set(featured.map((item) => item.id));

  const featuredWithFallback =
    featured.length >= 2
      ? featured
      : [
          ...featured,
          ...all.filter((item) => !featuredIds.has(item.id)).slice(0, 2 - featured.length),
        ];
  const featuredSet = new Set(featuredWithFallback.map((item) => item.id));
  const highlights = all.filter((item) => !featuredSet.has(item.id)).slice(0, 6);

  return {
    featured: featuredWithFallback,
    highlights,
  };
};

export async function GET() {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(getStaticHighlights(), {
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
    return NextResponse.json(getStaticHighlights(), {
      headers: {
        "Cache-Control": "s-maxage=30, stale-while-revalidate=300",
      },
    });
  }
}
