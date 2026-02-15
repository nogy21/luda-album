import Image from "next/image";
import Link from "next/link";

import { pickRandomPastDailyMemory } from "@/lib/gallery/landing";
import type { PhotoItem } from "@/lib/gallery/types";

type LandingMemorySectionProps = {
  items: PhotoItem[];
};

const buildDateLink = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-");
  return `/photos?year=${year}&month=${month}&day=${day}`;
};

export function LandingMemorySection({ items }: LandingMemorySectionProps) {
  const memory = pickRandomPastDailyMemory(items);

  if (!memory) {
    return null;
  }

  return (
    <section className="mx-auto mt-[var(--space-section-md)] w-full max-w-[860px] px-4 sm:px-6">
      <div className="ui-surface rounded-[var(--radius-lg)] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="ui-title">추억 회상</h2>
          <span className="text-[var(--text-meta)] font-medium text-[color:var(--color-muted)]">
            {memory.label}
          </span>
        </div>

        <Link
          href={buildDateLink(memory.dateKey)}
          className="grid grid-cols-3 gap-1.5"
          aria-label={`${memory.label} 사진 보기`}
        >
          {memory.items.map((item) => (
            <div
              key={item.id}
              className="relative overflow-hidden rounded-[0.8rem] bg-[color:var(--color-surface)]"
            >
              <Image
                src={item.thumbSrc ?? item.src}
                alt={item.alt}
                width={360}
                height={360}
                sizes="(max-width: 640px) 32vw, 220px"
                className="aspect-square w-full object-cover"
              />
            </div>
          ))}
        </Link>
      </div>
    </section>
  );
}
