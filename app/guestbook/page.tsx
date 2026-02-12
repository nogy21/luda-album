import { AppShell, CoverCard } from "@/components/app-shell";
import { GuestbookSection } from "@/components/guestbook-section";

export default function GuestbookPage() {
  return (
    <AppShell>
      <CoverCard />
      <GuestbookSection />
    </AppShell>
  );
}
