import { AppShell, CoverCard } from "@/components/app-shell";
import { GallerySection } from "@/components/gallery-section";
import { groupGalleryImagesByMonth } from "@/lib/gallery/grouping";
import { galleryImages } from "@/lib/gallery/images";
import {
  listPhotoHighlightsFromDatabase,
  listPhotosPageFromDatabase,
  mapGalleryImageToPhotoItem,
  mapPhotoItemToGalleryImage,
} from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { HighlightResponse, PhotoListResponse } from "@/lib/gallery/types";

export const dynamic = "force-dynamic";

const INITIAL_LIMIT = 36;

const buildStaticPhotoResponse = (): PhotoListResponse => {
  const items = galleryImages
    .map(mapGalleryImageToPhotoItem)
    .filter((item) => item.visibility === "family")
    .sort((left, right) => +new Date(right.takenAt) - +new Date(left.takenAt));
  const pageItems = items.slice(0, INITIAL_LIMIT);
  const grouped = groupGalleryImagesByMonth(items.map(mapPhotoItemToGalleryImage));

  return {
    items: pageItems,
    nextCursor:
      items.length > INITIAL_LIMIT && pageItems.length > 0
        ? `${pageItems[pageItems.length - 1].takenAt}|${pageItems[pageItems.length - 1].id}`
        : null,
    summary: {
      totalCount: items.length,
      yearMonthStats: grouped.map((group) => ({
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
    },
  };
};

const buildStaticHighlights = (source: PhotoListResponse): HighlightResponse => {
  const sorted = [...source.items].sort(
    (left, right) => +new Date(right.takenAt) - +new Date(left.takenAt),
  );

  return {
    featured: sorted.slice(0, 2),
    highlights: sorted.slice(2, 8),
  };
};

export default async function PhotosPage() {
  const supabase = createServerSupabaseClient();
  let initialData = buildStaticPhotoResponse();
  let initialHighlights = buildStaticHighlights(initialData);

  if (supabase) {
    try {
      const [photoData, highlightData] = await Promise.all([
        listPhotosPageFromDatabase(supabase, {
          limit: INITIAL_LIMIT,
          visibility: "family",
        }),
        listPhotoHighlightsFromDatabase(supabase, {
          featuredLimit: 2,
          highlightLimit: 6,
          visibility: "family",
        }),
      ]);

      if (photoData.items.length > 0) {
        initialData = photoData;
        initialHighlights = highlightData;
      }
    } catch {
      // Fall back to bundled static gallery images and metadata.
    }
  }

  const heroImages = [
    ...initialHighlights.featured,
    ...initialHighlights.highlights,
  ].map(mapPhotoItemToGalleryImage);

  return (
    <AppShell>
      <CoverCard
        images={heroImages.length > 0 ? heroImages : initialData.items.map(mapPhotoItemToGalleryImage)}
      />
      <GallerySection
        initialData={initialData}
        initialHighlights={initialHighlights}
      />
    </AppShell>
  );
}
