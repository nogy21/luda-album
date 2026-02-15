import { FixedBottomNav } from "@/components/fixed-bottom-nav";
import { LandingGuestbookCta } from "@/components/landing-guestbook-cta";
import { LandingHero } from "@/components/landing-hero";
import { LandingRecentSection } from "@/components/landing-recent-section";
import { LudaDayBanner } from "@/components/luda-day-banner";
import { NewPhotoBottomSheet } from "@/components/new-photo-bottom-sheet";
import { galleryImages } from "@/lib/gallery/images";
import {
  listPhotosPageFromDatabase,
  mapGalleryImageToPhotoItem,
} from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createServerSupabaseClient();
  let items = galleryImages
    .map(mapGalleryImageToPhotoItem)
    .filter((item) => item.visibility === "family")
    .sort((left, right) => +new Date(right.takenAt) - +new Date(left.takenAt));

  if (supabase) {
    try {
      const response = await listPhotosPageFromDatabase(supabase, {
        limit: 48,
        visibility: "family",
      });

      if (response.items.length > 0) {
        items = response.items;
      }
    } catch (error) {
      void error;
    }
  }

  return (
    <div className="min-h-screen" style={{ paddingBottom: "var(--landing-bottom-safe-space)" }}>
      <LudaDayBanner birthDateIso="2025-10-22T00:00:00.000Z" />
      <LandingHero items={items} />
      <LandingRecentSection items={items} />
      <LandingGuestbookCta />
      <NewPhotoBottomSheet latestPhotoTakenAt={items[0]?.takenAt ?? null} />
      <FixedBottomNav maxWidth={860} />
    </div>
  );
}
