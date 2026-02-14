import Image from "next/image";
import Link from "next/link";

import type { PhotoItem } from "@/lib/gallery/types";

type LandingRecentSectionProps = {
  items: PhotoItem[];
};

export function LandingRecentSection({ items }: LandingRecentSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto mt-4 w-full max-w-[860px] px-4 sm:px-6">
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-white p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="text-[1.05rem] font-semibold text-[color:var(--color-ink)]">요즘 루다는...</h2>
          <Link
            href="/photos"
            className="text-[0.8rem] font-semibold text-[color:var(--color-brand-strong)]"
          >
            더 보기
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {items.slice(0, 8).map((item) => (
            <Link
              key={item.id}
              href="/photos"
              className="relative overflow-hidden rounded-[0.75rem] bg-[#eceff3]"
              aria-label={`${item.caption} 보기`}
            >
              <Image
                src={item.thumbSrc ?? item.src}
                alt={item.alt}
                width={280}
                height={280}
                sizes="(max-width: 640px) 24vw, 180px"
                className="aspect-square w-full object-cover"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
