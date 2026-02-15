"use client";

import { useMemo } from "react";

import { calculateDaysSince } from "@/lib/ui/day-count";

type LudaDayBannerProps = {
  birthDateIso: string;
};

export function LudaDayBanner({ birthDateIso }: LudaDayBannerProps) {
  const days = useMemo(() => calculateDaysSince(birthDateIso), [birthDateIso]);

  return (
    <section className="mx-auto w-full max-w-[860px] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
      <div className="rounded-[1rem] border border-[color:var(--color-line)] bg-[color:var(--color-brand-soft)]/70 px-4 py-3 text-[color:var(--color-ink)] shadow-[var(--shadow-soft)]">
        <p className="text-[0.73rem] font-semibold text-[color:var(--color-brand-strong)]">성장 배너</p>
        <h2 className="mt-0.5 text-[1rem] font-semibold tracking-[-0.01em]">
          루다는 오늘 {days}일이에요!
        </h2>
      </div>
    </section>
  );
}
