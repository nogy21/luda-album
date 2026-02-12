import { AppShell, CoverCard } from "@/components/app-shell";
import { GallerySection } from "@/components/gallery-section";

export default function PhotosPage() {
  return (
    <AppShell>
      <CoverCard />
      <GallerySection />
    </AppShell>
  );
}
