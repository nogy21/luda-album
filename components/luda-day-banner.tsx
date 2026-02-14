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
      <div className="rounded-[1rem] border border-[color:var(--color-line)] bg-[linear-gradient(135deg,var(--color-brand),var(--color-brand-strong))] px-4 py-3 text-white shadow-[var(--shadow-float)]">
        <p className="text-[0.75rem] font-medium text-white/85">성장 배너</p>
        <h2 className="mt-0.5 text-[1.05rem] font-semibold tracking-[-0.01em]">
          루다는 오늘 {days}일이에요!
        </h2>
      </div>
    </section>
  );
}
