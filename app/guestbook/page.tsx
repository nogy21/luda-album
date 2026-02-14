import { AppShell, CoverCard } from "@/components/app-shell";
import { GuestbookSection } from "@/components/guestbook-section";

type GuestbookPageSearchParams = {
  prefill?: string;
};

export default async function GuestbookPage({ searchParams }: { searchParams?: Promise<GuestbookPageSearchParams> }) {
  const resolvedSearchParams = (await searchParams) ?? {};

  return (
    <AppShell>
      <CoverCard />
      <GuestbookSection prefillMessage={resolvedSearchParams.prefill} />
    </AppShell>
  );
}
