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
    <section className="mx-auto mt-[var(--space-section-md)] w-full max-w-[860px] px-4 sm:px-6">
      <div className="ui-surface rounded-[var(--radius-lg)] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="ui-title">요즘 루다는...</h2>
          <Link href="/photos" className="ui-btn ui-btn-secondary px-3">
            더 보기
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {items.slice(0, 3).map((item) => (
            <Link
              key={item.id}
              href="/photos"
              className="relative overflow-hidden rounded-[0.8rem] bg-[color:var(--color-surface)]"
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
