"use client";

import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

import {
  LANDING_INTRO_SESSION_KEY,
  markHeroIntroSeen,
  shouldRunHeroIntro,
} from "@/lib/ui/hero-intro";
import type { PhotoItem } from "@/lib/gallery/types";

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

const buildMonthArchiveLink = (takenAt: string) => {
  const date = new Date(takenAt);
  return `/photos?year=${date.getUTCFullYear()}&month=${date.getUTCMonth() + 1}`;
};

export function LandingHero({ items }: LandingHeroProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const sorted = useMemo(() => [...items].sort(sortByTakenAtDesc), [items]);
  const primaryImage = sorted[0] ?? null;
  const previewImages = sorted.slice(1, 4);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (
      reduceMotion ||
      !shouldRunHeroIntro(window.sessionStorage, LANDING_INTRO_SESSION_KEY)
    ) {
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
          duration: 0.3,
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

  if (!primaryImage) {
    return null;
  }

  return (
    <section
      ref={rootRef}
      className="mx-auto w-full max-w-[860px] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6"
    >
      <header className="mb-2.5 flex items-center justify-between gap-2" data-landing-intro="top">
        <p className="rounded-full border border-[color:var(--color-line)] bg-white px-3 py-1 text-[0.72rem] font-semibold text-[color:var(--color-muted)]">
          가족 전용 앨범
        </p>
        <p className="text-[0.73rem] font-medium text-[color:var(--color-muted)]">
          최신 {formatDateLabel(primaryImage.takenAt)} · 총 {sorted.length}장
        </p>
      </header>

      <article className="overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)] p-3.5 shadow-[var(--shadow-soft)] sm:p-4">
        <div className="flex items-end justify-between gap-3">
          <h1
            data-landing-intro="title"
            className="text-[clamp(1.48rem,5.2vw,2.1rem)] font-bold leading-[1.15] tracking-[-0.02em] text-[color:var(--color-ink)]"
          >
            루다의 오늘
          </h1>
          <Link
            href={buildMonthArchiveLink(primaryImage.takenAt)}
            className="text-[0.78rem] font-semibold text-[color:var(--color-brand-strong)]"
          >
            타임라인
          </Link>
        </div>

        <p data-landing-intro="value" className="mt-1 text-[0.84rem] leading-[1.5] text-[color:var(--color-muted)]">
          대표컷과 최근 프리뷰를 한 화면에서 확인해요.
        </p>

        <div
          className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2"
          data-landing-intro="featured"
        >
          <div className="relative col-span-2 overflow-hidden rounded-[0.95rem] bg-[#eceff3]">
            <Image
              src={primaryImage.thumbSrc ?? primaryImage.src}
              alt={primaryImage.alt}
              width={1200}
              height={900}
              priority
              sizes="(max-width: 640px) 66vw, 520px"
              className="aspect-[5/4] w-full object-cover"
            />
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2.5 pb-2 pt-8 text-[0.72rem] font-semibold text-white">
              {primaryImage.caption}
            </p>
          </div>
          <div className="grid gap-1.5">
            {previewImages.map((image) => (
              <div key={image.id} className="relative overflow-hidden rounded-[0.85rem] bg-[#eceff3]">
                <Image
                  src={image.thumbSrc ?? image.src}
                  alt={image.alt}
                  width={680}
                  height={680}
                  sizes="(max-width: 640px) 30vw, 220px"
                  className="aspect-square w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2.5" data-landing-intro="next-preview">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[0.78rem] font-semibold text-[color:var(--color-ink)]">요즘 루다는...</p>
            <Link
              href="/photos"
              className="text-[0.72rem] font-semibold text-[color:var(--color-brand-strong)]"
            >
              전체 앨범 보기
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {sorted.slice(0, 3).map((image) => (
              <div key={`peek-${image.id}`} className="relative overflow-hidden rounded-[0.75rem] bg-[#eceff3]">
                <Image
                  src={image.thumbSrc ?? image.src}
                  alt={image.alt}
                  width={420}
                  height={420}
                  sizes="(max-width: 640px) 32vw, 220px"
                  className="aspect-square w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}
