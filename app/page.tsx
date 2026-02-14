import { FixedBottomNav } from "@/components/fixed-bottom-nav";
import { LandingGuestbookCta } from "@/components/landing-guestbook-cta";
import { LandingHero } from "@/components/landing-hero";
import { LandingMemorySection } from "@/components/landing-memory-section";
import { LandingRecentSection } from "@/components/landing-recent-section";
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
    <div className="min-h-screen pb-[7.25rem]">
      <LandingHero items={items} />
      <LandingRecentSection items={items} />
      <LandingMemorySection items={items} />
      <LandingGuestbookCta />
      <FixedBottomNav maxWidth={860} />
    </div>
  );
}
