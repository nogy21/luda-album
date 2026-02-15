"use client";

import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { FixedBottomNav } from "@/components/fixed-bottom-nav";
import {
  getInitialFeaturedImages,
  getShuffledFeaturedImages,
} from "@/lib/gallery/featured";
import { type GalleryImage, galleryImages } from "@/lib/gallery/images";
import { markHeroIntroSeen, shouldRunHeroIntro } from "@/lib/ui/hero-intro";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen" style={{ paddingBottom: "var(--bottom-nav-safe-space)" }}>
      <a
        href="#main-content"
        className="ui-btn ui-btn-secondary absolute left-3 top-3 z-[90] -translate-y-24 px-3 text-sm focus-visible:translate-y-0"
      >
        본문으로 건너뛰기
      </a>
      <main
        id="main-content"
        className="mx-auto w-full max-w-[780px] px-3.5 pt-[max(0.4rem,env(safe-area-inset-top))] sm:px-5 sm:pt-3"
      >
        {children}
      </main>

      <FixedBottomNav maxWidth={780} />
    </div>
  );
}

type CoverCardProps = {
  images?: GalleryImage[];
};

export function CoverCard({ images = galleryImages }: CoverCardProps) {
  const [featuredImages, setFeaturedImages] = useState(() => getInitialFeaturedImages(images, 8));
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const heroRef = useRef<HTMLElement | null>(null);
  const latestDateLabel = useMemo(() => {
    const sorted = [...images].sort(
      (left, right) => +new Date(right.takenAt) - +new Date(left.takenAt),
    );
    const latest = sorted[0];

    if (!latest) {
      return "-";
    }

    const date = new Date(latest.takenAt);
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  }, [images]);
  const tileClasses = useMemo(
    () => [
      "col-span-4 row-span-4",
      "col-span-2 row-span-2",
      "col-span-2 row-span-2",
      "col-span-2 row-span-2",
      "col-span-2 row-span-2",
      "col-span-3 row-span-2",
      "col-span-3 row-span-2",
      "col-span-2 row-span-2",
      "col-span-2 row-span-2",
    ],
    [],
  );

  useEffect(() => {
    setFeaturedImages(getInitialFeaturedImages(images, 8));
  }, [images]);

  useEffect(() => {
    if (typeof window === "undefined" || reduceMotion) {
      return;
    }

    if (!shouldRunHeroIntro(window.sessionStorage)) {
      return;
    }

    const hero = heroRef.current;

    if (!hero) {
      return;
    }

    const targets = hero.querySelectorAll<HTMLElement>("[data-hero-intro]");

    if (targets.length === 0) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.44,
          ease: "power2.out",
          stagger: 0.07,
        },
      );
    }, hero);

    markHeroIntroSeen(window.sessionStorage);

    return () => {
      context.revert();
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    if (featuredImages.length === 0) {
      return;
    }

    const hero = heroRef.current;

    if (!hero) {
      return;
    }

    const tiles = hero.querySelectorAll<HTMLElement>("[data-hero-tile]");

    if (tiles.length === 0) {
      return;
    }

    const tween = gsap.fromTo(
      tiles,
      { opacity: 0, y: 10, scale: 0.985 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.36,
        ease: "power2.out",
        stagger: 0.05,
      },
    );

    return () => {
      tween.kill();
    };
  }, [reduceMotion, featuredImages.length]);

  const handleShuffle = () => {
    setFeaturedImages(getShuffledFeaturedImages(images, 8));
  };

  return (
    <section
      ref={heroRef}
      className="ui-surface mb-[var(--space-section-md)] overflow-hidden rounded-[var(--radius-xl)] p-4 sm:p-5"
    >
      <div className="mb-4 ui-stack-sm" data-hero-intro="meta">
        <p className="ui-eyebrow">Luda Album</p>
        <p className="text-[var(--text-meta)] font-medium text-[color:var(--color-muted)]">
          최근 기록 · {latestDateLabel}
        </p>
      </div>

      <h1
        className="max-w-[18ch] text-[length:var(--text-display)] font-bold leading-[var(--leading-tight)] tracking-[-0.02em] text-[color:var(--color-ink)]"
        data-hero-intro="title"
      >
        오늘의 루다 순간
      </h1>
      <p
        className="mt-2 max-w-[30ch] text-[var(--text-body)] leading-[var(--leading-body)] text-[color:var(--color-muted)]"
        data-hero-intro="description"
      >
        가장 최근 표정을 먼저 보고, 월별 아카이브로 천천히 이어서 감상해요.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5" data-hero-intro="cta">
        <Link href="#monthly-archive" className="ui-btn ui-btn-primary px-4">
          오늘 사진부터 보기
        </Link>
        <button
          type="button"
          onClick={handleShuffle}
          aria-label="대표 사진 다시 섞기"
          className="ui-btn-text px-2.5"
        >
          대표 사진 바꾸기
        </button>
      </div>
      <p
        className="mt-1.5 text-[0.78rem] leading-[1.45] text-[color:var(--color-muted)]"
        data-hero-intro="cta-note"
      >
        아카이브에서 월별로 이어서 보실 수 있어요.
      </p>

      <div className="mt-4 grid grid-cols-6 auto-rows-[74px] gap-1.5 sm:auto-rows-[88px]" data-hero-intro="gallery">
        {featuredImages.map((image, index) => (
          <article
            key={image.id}
            data-hero-tile
            className={`group relative overflow-hidden rounded-[0.9rem] bg-[color:var(--color-brand-soft)] text-left ${
              tileClasses[index] ?? "col-span-2 row-span-1"
            }`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={index < 3}
              sizes={index === 0 ? "(max-width: 640px) 66vw, 420px" : "(max-width: 640px) 36vw, 260px"}
              className="motion-safe-scale object-cover object-center"
            />
            {index < 2 ? (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/62 to-transparent px-2.5 pb-2 pt-8 text-[0.72rem] font-semibold text-white/95">
                {image.caption}
              </span>
            ) : null}
          </article>
        ))}
      </div>

      <Link
        href="#gallery-highlights"
        className="ui-subtle-surface mt-4 flex items-center justify-between rounded-[0.95rem] px-3 py-2.5 text-left"
        data-hero-intro="next-preview"
      >
        <span>
          <span className="block text-[0.7rem] font-semibold text-[color:var(--color-brand-strong)]">
            다음 섹션
          </span>
          <span className="block text-[0.84rem] font-medium text-[color:var(--color-ink)]">
            대표컷과 하이라이트 이어 보기
          </span>
        </span>
        <span aria-hidden="true" className="text-base text-[color:var(--color-muted)]">
          ↓
        </span>
      </Link>
    </section>
  );
}
