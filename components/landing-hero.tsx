"use client";

import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { PhotoItem } from "@/lib/gallery/types";
import {
  LANDING_INTRO_SESSION_KEY,
  markHeroIntroSeen,
  shouldRunHeroIntro,
} from "@/lib/ui/hero-intro";
import { lockPageScroll, unlockPageScroll } from "@/lib/ui/scroll-lock";

type LandingHeroProps = {
  items: PhotoItem[];
};

const sortByTakenAtDesc = (left: PhotoItem, right: PhotoItem) => {
  return +new Date(right.takenAt) - +new Date(left.takenAt);
};

const formatDateLabel = (takenAt: string) => {
  const date = new Date(takenAt);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

const buildDayLink = (takenAt: string) => {
  const date = new Date(takenAt);
  return `/photos?year=${date.getUTCFullYear()}&month=${date.getUTCMonth() + 1}&day=${date.getUTCDate()}`;
};

const inferPlace = (item: PhotoItem) => {
  const source = [item.caption, ...(item.tags ?? [])].join(" ");
  const match = source.match(/(집|공원|여행|바다|카페|한강)/);
  return match?.[0] ?? null;
};

export function LandingHero({ items }: LandingHeroProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => [...items].sort(sortByTakenAtDesc), [items]);
  const primaryImage = sorted[0] ?? null;
  const place = primaryImage ? inferPlace(primaryImage) : null;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || !shouldRunHeroIntro(window.sessionStorage, LANDING_INTRO_SESSION_KEY)) {
      return;
    }

    const root = rootRef.current;

    if (!root) {
      return;
    }

    const targets = root.querySelectorAll<HTMLElement>("[data-landing-intro]");

    if (targets.length === 0) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.26,
          ease: "power2.out",
          stagger: 0.05,
        },
      );
    }, root);

    markHeroIntroSeen(window.sessionStorage, LANDING_INTRO_SESSION_KEY);

    return () => {
      context.revert();
    };
  }, []);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const snapshot = lockPageScroll();

    return () => {
      unlockPageScroll(snapshot);
    };
  }, [expanded]);

  if (!primaryImage) {
    return null;
  }

  return (
    <section ref={rootRef} className="mx-auto mt-3 w-full max-w-[860px] px-4 sm:px-6">
      <article className="ui-surface overflow-hidden rounded-[var(--radius-xl)] p-3.5 sm:p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[0.74rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-brand-strong)]" data-landing-intro="meta">
            Luda Highlight
          </p>
          <p className="text-[0.72rem] font-medium text-[color:var(--color-muted)]" data-landing-intro="date">
            {formatDateLabel(primaryImage.takenAt)}
            {place ? ` · ${place}` : ""}
          </p>
        </div>

        <h1
          data-landing-intro="title"
          className="text-[clamp(1.34rem,4.9vw,1.82rem)] font-bold leading-[1.22] tracking-[-0.02em] text-[color:var(--color-ink)]"
        >
          루다 하이라이트
        </h1>

        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 block w-full overflow-hidden rounded-[0.95rem] bg-[color:var(--color-surface)] text-left"
          data-landing-intro="image"
          aria-label="루다 하이라이트 확대 보기"
        >
          <div className="relative">
            <Image
              src={primaryImage.thumbSrc ?? primaryImage.src}
              alt={primaryImage.alt}
              width={1200}
              height={900}
              priority
              sizes="(max-width: 860px) 92vw, 760px"
              className="aspect-[5/4] w-full object-cover"
            />
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2.5 pb-2 pt-8 text-[0.75rem] font-semibold text-white/95">
              {primaryImage.caption}
            </p>
          </div>
        </button>
      </article>

      {expanded ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/86 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="루다 하이라이트 이미지"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setExpanded(false);
            }
          }}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-[1.2rem] border border-white/10 bg-black">
            <Image
              src={primaryImage.src}
              alt={primaryImage.alt}
              width={1200}
              height={1400}
              sizes="(max-width: 860px) 92vw, 760px"
              className="max-h-[78vh] w-full object-contain"
              priority
            />
            <div className="space-y-2 border-t border-white/10 bg-black/90 px-3 py-3">
              <div>
                <p className="text-[0.9rem] font-semibold text-white/96">{primaryImage.caption}</p>
                <p className="text-[0.74rem] text-white/74">
                  {formatDateLabel(primaryImage.takenAt)}
                  {place ? ` · ${place}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={buildDayLink(primaryImage.takenAt)}
                  className="ui-btn ui-btn-primary px-4 text-[0.84rem]"
                >
                  해당 날짜 앨범으로 이동
                </Link>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="ui-btn rounded-full border border-white/25 bg-white/12 px-4 text-[0.82rem] text-white"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
