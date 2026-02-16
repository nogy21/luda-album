import { NextResponse } from "next/server";

import { groupGalleryImagesByMonth } from "@/lib/gallery/grouping";
import { galleryImages } from "@/lib/gallery/images";
import {
  listPhotoSummaryFromDatabase,
  mapGalleryImageToPhotoItem,
  mapPhotoItemToGalleryImage,
} from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PhotoSummaryResponse } from "@/lib/gallery/types";

const sortByTakenAtDesc = (left: { takenAt: string }, right: { takenAt: string }) => {
  return +new Date(right.takenAt) - +new Date(left.takenAt);
};

const buildStaticSummary = (): PhotoSummaryResponse => {
  const items = galleryImages
    .map(mapGalleryImageToPhotoItem)
    .filter((item) => item.visibility === "family")
    .sort(sortByTakenAtDesc);
  const grouped = groupGalleryImagesByMonth(items.map(mapPhotoItemToGalleryImage));

  return {
    totalCount: items.length,
    months: grouped.map((group) => ({
      key: group.key,
      year: group.year,
      month: group.month,
      count: group.items.length,
      latestTakenAt: group.latestTakenAt,
      latestUpdatedAt: group.latestUpdatedAt,
      label: group.label,
      updatedLabel: group.updatedLabel,
      metaLabel: group.metaLabel,
    })),
  };
};

export async function GET() {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(buildStaticSummary(), {
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
    return NextResponse.json(buildStaticSummary(), {
      headers: {
        "Cache-Control": "s-maxage=30, stale-while-revalidate=300",
      },
    });
  }
}
