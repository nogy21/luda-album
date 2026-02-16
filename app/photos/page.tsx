import { AppShell, CoverCard } from "@/components/app-shell";
import { GallerySection } from "@/components/gallery-section";
import { NewPhotoBottomSheet } from "@/components/new-photo-bottom-sheet";
import { PushNotificationPanel } from "@/components/push-notification-panel";
import {
  listPhotoHighlightsFromDatabase,
  listPhotoSummaryFromDatabase,
  listPhotosMonthPageFromDatabase,
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

const buildEmptySummary = (): PhotoSummaryResponse => ({
  totalCount: 0,
  months: [],
});

const buildEmptyHighlights = (): HighlightResponse => ({
  featured: [],
  highlights: [],
});

export default async function PhotosPage() {
  const supabase = createServerSupabaseClient();
  let initialSummary = buildEmptySummary();
  let initialHighlights = buildEmptyHighlights();
  let initialMonthPages: Record<string, PhotoMonthPageResponse> = {};

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

      initialMonthPages = Object.fromEntries(monthPages.map((page) => [page.key, page]));
    } catch {
      // Keep empty initial state and rely on month-level retries in the client.
    }
  }

  const preloadItems = Object.values(initialMonthPages)
    .flatMap((page) => page.items)
    .sort(sortByTakenAtDesc);
  const coverItems = preloadItems;

  return (
    <AppShell>
      <CoverCard images={coverItems.map(mapPhotoItemToGalleryImage)} />
      <PushNotificationPanel />
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
