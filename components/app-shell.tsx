"use client";

import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  getInitialFeaturedImages,
  getShuffledFeaturedImages,
} from "@/lib/gallery/featured";
import { type GalleryImage, galleryImages } from "@/lib/gallery/images";
import { markHeroIntroSeen, shouldRunHeroIntro } from "@/lib/ui/hero-intro";

type AppShellProps = {
  children: ReactNode;
};

const tabs = [
  { href: "/photos", label: "사진" },
  { href: "/guestbook", label: "덕담" },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const safeBottomPadding = "max(0.95rem, env(safe-area-inset-bottom))";

  return (
    <div className="min-h-screen pb-[7.25rem]">
      <a
        href="#main-content"
        className="absolute left-3 top-3 z-50 -translate-y-24 rounded-full bg-[color:var(--color-brand)] px-3 py-2 text-sm font-semibold text-white transition focus-visible:translate-y-0"
      >
        본문으로 건너뛰기
      </a>
      <header
        className="sticky top-0 z-40 border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)]/96 px-3.5 pb-2.5 sm:px-5"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="mx-auto flex w-full max-w-[780px] items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white px-3 py-2">
          <div className="min-w-0">
            <Link
              href="/photos"
              className="block truncate text-[length:var(--text-app-title)] font-bold tracking-[-0.02em] text-[color:var(--color-ink)]"
            >
              Luda Album
            </Link>
            <p className="truncate text-[0.74rem] font-medium text-[color:var(--color-muted)]">
              루다의 가족 추억 앨범
            </p>
          </div>
          <div className="shrink-0 rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.03em] text-[color:var(--color-muted)]">
            FAMILY ONLY
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-[780px] px-3.5 pt-3.5 sm:px-5 sm:pt-4">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 px-3.5 pt-2 sm:px-5" style={{ paddingBottom: safeBottomPadding }}>
        <div className="mx-auto grid w-full max-w-[780px] grid-cols-2 gap-1.5 rounded-[1.35rem] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)] p-1.5 text-[0.94rem] shadow-[var(--shadow-soft)]">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex min-h-11 items-center justify-center rounded-[1rem] px-3 py-2.5 text-center text-[0.95rem] font-semibold transition-colors ${isActive
                  ? "bg-[color:var(--color-brand)] text-white shadow-[0_8px_16px_rgba(26,115,232,0.25)]"
                  : "text-[color:var(--color-muted)] hover:bg-[color:var(--color-brand-soft)] active:bg-[color:var(--color-brand-soft)]/90"
                  }`}
              >
                {tab.label}
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 bottom-1.5 h-[2px] rounded-full bg-white/88"
                  />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
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
            Family Memory
          </p>
          <p className="mt-1 text-[0.76rem] font-medium text-[color:var(--color-muted)]">
            총 {images.length}장 · {latestDateLabel}
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

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5" data-hero-intro="actions">
        <a
          href="#gallery"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--color-brand)] px-4 py-2.5 text-[0.88rem] font-semibold text-white shadow-[0_8px_16px_rgba(26,115,232,0.22)] transition hover:bg-[color:var(--color-brand-strong)]"
        >
          이번 달 사진 보기
        </a>
      </div>

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
