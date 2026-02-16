import { AppShell, CoverCard } from "@/components/app-shell";
import { GallerySection } from "@/components/gallery-section";
import { NewPhotoBottomSheet } from "@/components/new-photo-bottom-sheet";
import { groupGalleryImagesByMonth } from "@/lib/gallery/grouping";
import { galleryImages } from "@/lib/gallery/images";
import {
  listPhotoHighlightsFromDatabase,
  listPhotoSummaryFromDatabase,
  listPhotosMonthPageFromDatabase,
  mapGalleryImageToPhotoItem,
  mapPhotoItemToGalleryImage,
} from "@/lib/gallery/repository";
import type {
  HighlightResponse,
  PhotoItem,
  PhotoMonthPageResponse,
  PhotoSummaryResponse,
} from "@/lib/gallery/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const INITIAL_MONTH_PAGE_LIMIT = 24;
const INITIAL_PRELOAD_MONTHS = 2;

const sortByTakenAtDesc = (left: PhotoItem, right: PhotoItem) => {
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

const buildStaticMonthPage = (
  year: number,
  month: number,
  limit = INITIAL_MONTH_PAGE_LIMIT,
): PhotoMonthPageResponse => {
  const monthItems = galleryImages
    .map(mapGalleryImageToPhotoItem)
    .filter((item) => item.visibility === "family")
    .filter((item) => {
      const date = new Date(item.takenAt);
      return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month;
    })
    .sort(sortByTakenAtDesc);
  const pageItems = monthItems.slice(0, limit);
  const hasMore = monthItems.length > limit;

  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    year,
    month,
    items: pageItems,
    nextCursor:
      hasMore && pageItems.length > 0
        ? `${pageItems[pageItems.length - 1].takenAt}|${pageItems[pageItems.length - 1].id}`
        : null,
  };
};

const buildStaticHighlights = (): HighlightResponse => {
  const sorted = galleryImages
    .map(mapGalleryImageToPhotoItem)
    .filter((item) => item.visibility === "family")
    .sort(sortByTakenAtDesc);

  return {
    featured: sorted.slice(0, 2),
    highlights: sorted.slice(2, 8),
  };
};

const preloadStaticMonthPages = (
  summary: PhotoSummaryResponse,
): Record<string, PhotoMonthPageResponse> => {
  return Object.fromEntries(
    summary.months
      .slice(0, INITIAL_PRELOAD_MONTHS)
      .map((month) => [
        month.key,
        buildStaticMonthPage(month.year, month.month, INITIAL_MONTH_PAGE_LIMIT),
      ]),
  );
};

export default async function PhotosPage() {
  const supabase = createServerSupabaseClient();
  let initialSummary = buildStaticSummary();
  let initialHighlights = buildStaticHighlights();
  let initialMonthPages = preloadStaticMonthPages(initialSummary);

  if (supabase) {
    try {
      const [summary, highlightData] = await Promise.all([
        listPhotoSummaryFromDatabase(supabase, { visibility: "family" }),
        listPhotoHighlightsFromDatabase(supabase, {
          featuredLimit: 2,
          highlightLimit: 6,
          visibility: "family",
        }),
      ]);

      if (summary.totalCount > 0) {
        initialSummary = summary;
        initialHighlights = highlightData;

        const monthPages = await Promise.all(
          summary.months
            .slice(0, INITIAL_PRELOAD_MONTHS)
            .map((month) =>
              listPhotosMonthPageFromDatabase(
                supabase,
                {
                  year: month.year,
                  month: month.month,
                  limit: INITIAL_MONTH_PAGE_LIMIT,
                  visibility: "family",
                },
              ),
            ),
        );

        initialMonthPages = Object.fromEntries(
          monthPages.map((page) => [page.key, page]),
        );
      }
    } catch {
      // Fall back to bundled static gallery images and metadata.
    }
  }

  const preloadItems = Object.values(initialMonthPages)
    .flatMap((page) => page.items)
    .sort(sortByTakenAtDesc);
  const coverItems = preloadItems.length > 0
    ? preloadItems
    : galleryImages
        .map(mapGalleryImageToPhotoItem)
        .filter((item) => item.visibility === "family")
        .sort(sortByTakenAtDesc);

  return (
    <AppShell>
      <CoverCard images={coverItems.map(mapPhotoItemToGalleryImage)} />
      <GallerySection
        initialSummary={initialSummary}
        initialHighlights={initialHighlights}
        initialMonthPages={initialMonthPages}
      />
      <NewPhotoBottomSheet
        latestPhotoTakenAt={
          initialSummary.months[0]?.latestTakenAt ?? coverItems[0]?.takenAt ?? null
        }
      />
    </AppShell>
  );
}
