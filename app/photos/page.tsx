import { AppShell, CoverCard } from "@/components/app-shell";
import { GallerySection } from "@/components/gallery-section";
import { galleryImages } from "@/lib/gallery/images";
import { listGalleryImagesFromDatabase } from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const supabase = createServerSupabaseClient();
  let images = galleryImages;

  if (supabase) {
    try {
      const dbImages = await listGalleryImagesFromDatabase(supabase);

      if (dbImages.length > 0) {
        images = dbImages;
      }
    } catch {
      // Fall back to bundled static gallery images.
    }
  }

  return (
    <AppShell>
      <CoverCard images={images} />
      <GallerySection images={images} />
    </AppShell>
  );
}
