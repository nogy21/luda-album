import { FixedBottomNav } from "@/components/fixed-bottom-nav";
import { HomeTimelineSection } from "@/components/home-timeline-section";
import { LudaDayBanner } from "@/components/luda-day-banner";
import { NewPhotoBottomSheet } from "@/components/new-photo-bottom-sheet";
import { PhotoRefreshButton } from "@/components/photo-refresh-button";
import { PushNotificationPanel } from "@/components/push-notification-panel";
import { listPhotosPageFromDatabase } from "@/lib/gallery/repository";
import type { PhotoItem } from "@/lib/gallery/types";
import { listE2EFixturePhotosPage } from "@/lib/gallery/e2e-fixtures";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isE2EFixtureModeEnabled } from "@/lib/testing/e2e-fixture-mode";

export default async function Home() {
  const supabase = createServerSupabaseClient();
  const fixtureMode = isE2EFixtureModeEnabled();
  let initialTimelineItems: PhotoItem[] = [];
  let initialTimelineNextCursor: string | null = null;

  if (supabase) {
    try {
      const response = await listPhotosPageFromDatabase(supabase, {
        limit: 10,
        visibility: "family",
      });

      initialTimelineItems = response.items;
      initialTimelineNextCursor = response.nextCursor;
    } catch (error) {
      void error;

      if (fixtureMode) {
        const response = listE2EFixturePhotosPage({ limit: 10 });
        initialTimelineItems = response.items;
        initialTimelineNextCursor = response.nextCursor;
      }
    }
  } else if (fixtureMode) {
    const response = listE2EFixturePhotosPage({ limit: 10 });
    initialTimelineItems = response.items;
    initialTimelineNextCursor = response.nextCursor;
  }

  return (
    <div className="page-bottom-safe min-h-screen">
      <LudaDayBanner birthDateIso="2025-10-22T00:00:00.000Z" />
      <PhotoRefreshButton />
      <div className="layout-container mt-[var(--space-section-sm)]">
        <PushNotificationPanel />
      </div>
      <HomeTimelineSection
        initialItems={initialTimelineItems}
        initialNextCursor={initialTimelineNextCursor}
      />
      <NewPhotoBottomSheet latestPhotoTakenAt={initialTimelineItems[0]?.takenAt ?? null} />
      <FixedBottomNav />
    </div>
  );
}
