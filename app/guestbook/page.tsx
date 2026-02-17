import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { GuestbookSection } from "@/components/guestbook-section";

export default function GuestbookPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <GuestbookSection />
      </Suspense>
    </AppShell>
  );
}
