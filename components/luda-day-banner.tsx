"use client";

import { useMemo } from "react";

import { calculateDaysSince } from "@/lib/ui/day-count";

type LudaDayBannerProps = {
  birthDateIso: string;
};

export function LudaDayBanner({ birthDateIso }: LudaDayBannerProps) {
  const days = useMemo(() => calculateDaysSince(birthDateIso), [birthDateIso]);

  return (
    <section className="mx-auto w-full max-w-[860px] px-4 pt-[max(0.68rem,env(safe-area-inset-top))] sm:px-6">
      <div className="rounded-[1rem] border border-[color:color-mix(in_srgb,var(--color-line)_56%,#fff_44%)] bg-[color:var(--color-brand-soft)] px-4 py-3 text-[color:var(--color-ink)]">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-brand-strong)]">
          성장 배너
        </p>
        <h2 className="mt-1 text-[1rem] font-semibold leading-[1.34] tracking-[-0.01em]">
          루다는 오늘 {days}일이에요!
        </h2>
      </div>
    </section>
  );
}
