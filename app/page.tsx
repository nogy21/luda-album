import { FixedBottomNav } from "@/components/fixed-bottom-nav";
import { LandingGuestbookCta } from "@/components/landing-guestbook-cta";
import { LandingHero } from "@/components/landing-hero";
import { LandingRecentSection } from "@/components/landing-recent-section";
import { LudaDayBanner } from "@/components/luda-day-banner";
import { NewPhotoBottomSheet } from "@/components/new-photo-bottom-sheet";
import { PushNotificationPanel } from "@/components/push-notification-panel";
import { listPhotosPageFromDatabase } from "@/lib/gallery/repository";
import type { PhotoItem } from "@/lib/gallery/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createServerSupabaseClient();
  let items: PhotoItem[] = [];

  if (supabase) {
    try {
      const response = await listPhotosPageFromDatabase(supabase, {
        limit: 48,
        visibility: "family",
      });

      items = response.items;
    } catch (error) {
      void error;
    }
  }

  return (
    <div className="page-bottom-safe min-h-screen">
      <LudaDayBanner birthDateIso="2025-10-22T00:00:00.000Z" />
      <LandingHero items={items} />
      <div className="layout-container mt-[var(--space-section-sm)]">
        <PushNotificationPanel />
      </div>
      <LandingRecentSection items={items} />
      <LandingGuestbookCta />
      <NewPhotoBottomSheet latestPhotoTakenAt={items[0]?.takenAt ?? null} />
      <FixedBottomNav />
    </div>
  );
}
