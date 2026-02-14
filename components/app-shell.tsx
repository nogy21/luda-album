"use client";

import gsap from "gsap";
import Image from "next/image";
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
    <div className="min-h-screen pb-[7.25rem]">
      <a
        href="#main-content"
        className="absolute left-3 top-3 z-50 -translate-y-24 rounded-full bg-[color:var(--color-brand)] px-3 py-2 text-sm font-semibold text-white transition focus-visible:translate-y-0"
      >
        본문으로 건너뛰기
      </a>
      <main id="main-content" className="mx-auto w-full max-w-[780px] px-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-4">
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
      className="mb-6 overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)] p-3.5 shadow-[var(--shadow-soft)] sm:p-4.5"
    >
        <div className="mb-3.5 flex items-start justify-between gap-2.5">
          <div data-hero-intro="meta">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-strong)]">
              Album Highlight
            </p>
            <p className="mt-1 text-[0.76rem] font-medium text-[color:var(--color-muted)]">
              최근 촬영 · {latestDateLabel}
            </p>
          </div>
        <button
          type="button"
          onClick={handleShuffle}
          className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 py-2 text-[0.78rem] font-semibold text-[color:var(--color-muted)] transition-colors hover:bg-[color:var(--color-brand-soft)]"
        >
          하이라이트 새로 섞기
        </button>
      </div>

      <h1
        className="max-w-[20ch] text-[length:var(--text-hero-title)] font-bold leading-[1.24] tracking-[-0.02em] text-[color:var(--color-ink)]"
        data-hero-intro="title"
      >
        루다의 오늘 사진
      </h1>

      <div className="mt-3 grid grid-cols-6 auto-rows-[76px] gap-2 sm:auto-rows-[92px]" data-hero-intro="gallery">
        {featuredImages.map((image, index) => (
          <article
            key={image.id}
            data-hero-tile
              className={`group relative overflow-hidden rounded-[0.95rem] bg-[#eceff3] text-left shadow-[0_4px_12px_rgba(32,33,36,0.08)] ${
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
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/62 to-transparent px-2.5 pb-2 pt-8 text-[0.74rem] font-semibold text-white/95">
                {image.caption}
              </span>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
