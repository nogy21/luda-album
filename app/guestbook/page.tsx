import { AppShell } from "@/components/app-shell";
import { GuestbookCoverCard } from "@/components/guestbook-cover-card";
import { GuestbookSection } from "@/components/guestbook-section";

type GuestbookPageSearchParams = {
  prefill?: string;
};

export default async function GuestbookPage({ searchParams }: { searchParams?: Promise<GuestbookPageSearchParams> }) {
  const resolvedSearchParams = (await searchParams) ?? {};

  return (
    <AppShell>
      <GuestbookCoverCard />
      <GuestbookSection prefillMessage={resolvedSearchParams.prefill} />
    </AppShell>
  );
}
