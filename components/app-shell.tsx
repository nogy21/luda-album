"use client";

import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  getInitialFeaturedImages,
  getShuffledFeaturedImages,
} from "@/lib/gallery/featured";
import { type GalleryImage, galleryImages } from "@/lib/gallery/images";
import { markHeroIntroSeen, shouldRunHeroIntro } from "@/lib/ui/hero-intro";
import { buildSoftRevealTransition } from "@/lib/ui/motion-config";

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
        className="sticky top-0 z-40 border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)]/88 px-3.5 pb-2.5 backdrop-blur-xl sm:px-5"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="mx-auto flex w-full max-w-[780px] items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white/85 px-3 py-2 shadow-[0_10px_24px_rgba(147,72,96,0.12)]">
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
          <div className="shrink-0 rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-brand-soft)] px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.05em] text-[color:var(--color-brand-strong)]">
            FAMILY ONLY
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-[780px] px-3.5 pt-3.5 sm:px-5 sm:pt-4">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 px-3.5 pt-2 sm:px-5" style={{ paddingBottom: safeBottomPadding }}>
        <div className="mx-auto grid w-full max-w-[780px] grid-cols-2 gap-1.5 rounded-[1.35rem] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)]/92 p-1.5 text-[0.94rem] shadow-[var(--shadow-card)] backdrop-blur-xl">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex min-h-11 items-center justify-center rounded-[1rem] px-3 py-2.5 text-center text-[0.95rem] font-semibold transition-colors ${isActive
                  ? "bg-[color:var(--color-brand)] text-white shadow-[0_12px_24px_rgba(233,106,141,0.45)]"
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
  const [featuredImages, setFeaturedImages] = useState(() =>
    getInitialFeaturedImages(images),
  );
  const [ctaMessage, setCtaMessage] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const reduceMotion = !!shouldReduceMotion;
  const heroRef = useRef<HTMLElement | null>(null);
  const allowanceButtonRef = useRef<HTMLButtonElement | null>(null);
  const allowanceBurstRef = useRef<HTMLSpanElement | null>(null);
  const ctaNoticeTimerRef = useRef<number | null>(null);
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
      "col-span-3 row-span-2",
      "col-span-3 row-span-2",
    ],
    [],
  );

  useEffect(() => {
    setFeaturedImages(getInitialFeaturedImages(images));
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
          duration: 0.42,
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
    return () => {
      if (ctaNoticeTimerRef.current !== null) {
        window.clearTimeout(ctaNoticeTimerRef.current);
      }
    };
  }, []);

  const runAllowanceBurst = () => {
    if (ctaNoticeTimerRef.current !== null) {
      window.clearTimeout(ctaNoticeTimerRef.current);
    }

    setCtaMessage("세뱃돈 부탁 메시지를 준비했어요.");
    ctaNoticeTimerRef.current = window.setTimeout(() => {
      setCtaMessage(null);
    }, 1800);

    if (reduceMotion) {
      return;
    }

    const button = allowanceButtonRef.current;
    const burstRoot = allowanceBurstRef.current;

    if (!button || !burstRoot) {
      return;
    }

    const particles = Array.from(
      burstRoot.querySelectorAll<HTMLElement>("[data-burst-particle]"),
    );

    gsap.killTweensOf(button);
    gsap.killTweensOf(particles);

    gsap.fromTo(
      button,
      { scale: 1 },
      {
        scale: 1.06,
        duration: 0.12,
        yoyo: true,
        repeat: 1,
        ease: "power1.out",
      },
    );

    gsap.set(particles, { x: 0, y: 0, opacity: 0, scale: 0.35 });

    particles.forEach((particle, index) => {
      const angle = (index / particles.length) * Math.PI * 2;
      const x = Math.cos(angle) * 46;
      const y = Math.sin(angle) * 26;

      gsap.to(particle, {
        opacity: 1,
        scale: 1,
        duration: 0.08,
        delay: 0.02 + index * 0.01,
        ease: "power1.out",
      });
      gsap.to(particle, {
        x,
        y,
        opacity: 0,
        scale: 0.3,
        duration: 0.48,
        delay: 0.08,
        ease: "power2.out",
      });
    });
  };

  return (
    <motion.section
      ref={heroRef}
      className="mb-4 overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)] p-3.5 shadow-[var(--shadow-float)] sm:p-4.5"
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={buildSoftRevealTransition(reduceMotion, 0.04)}
    >
      <div className="mb-3.5 flex items-start justify-between gap-2.5">
        <div data-hero-intro="meta">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-strong)]">
            Family Memory
          </p>
          <p className="mt-1 text-[0.78rem] font-medium text-[color:var(--color-muted)]">
            총 {images.length}장 · {latestDateLabel} 업데이트
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFeaturedImages(getShuffledFeaturedImages(images))}
          className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 py-2 text-[0.78rem] font-semibold text-[color:var(--color-muted)] transition-colors hover:bg-[color:var(--color-brand-soft)]"
        >
          하이라이트 새로 섞기
        </button>
      </div>

      <h1
        className="max-w-[20ch] text-[length:var(--text-hero-title)] font-bold leading-[1.24] tracking-[-0.02em] text-[color:var(--color-ink)]"
        data-hero-intro="title"
      >
        루다의 첫 설날, 오늘의 인사를 사진으로 전해요.
      </h1>
      <p
        className="mt-2 max-w-[38ch] text-[0.94rem] leading-[1.65] text-[color:var(--color-muted)]"
        data-hero-intro="description"
      >
        오늘 가장 빛난 순간부터 지난달 추억까지 이어서 보실 수 있어요. 먼저 이번 달 대표 컷을 확인해 보세요.
      </p>

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5" data-hero-intro="actions">
        <a
          href="#gallery"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--color-brand)] px-4 py-2.5 text-[0.88rem] font-semibold text-white shadow-[0_12px_24px_rgba(233,106,141,0.34)] transition hover:bg-[color:var(--color-brand-strong)]"
        >
          이번 달 추억 보기
        </a>
        <span className="relative inline-flex">
          <button
            ref={allowanceButtonRef}
            type="button"
            onClick={runAllowanceBurst}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--color-line)] bg-white px-4 py-2.5 text-[0.88rem] font-semibold text-[color:var(--color-ink)] transition hover:bg-[color:var(--color-brand-soft)]"
          >
            용돈 주세요
          </button>
          <span
            ref={allowanceBurstRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            {Array.from({ length: 10 }).map((_, index) => (
              <span
                key={index}
                data-burst-particle
                className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--color-brand)] opacity-0"
              />
            ))}
          </span>
        </span>
        <Link
          href="/guestbook"
          className="inline-flex min-h-11 items-center justify-center rounded-full px-2 text-[0.83rem] font-semibold text-[color:var(--color-brand-strong)] underline decoration-[color:var(--color-brand)]/45 underline-offset-4"
        >
          덕담 남기러 가기
        </Link>
      </div>
      <p className="mt-2 h-5 text-[0.76rem] font-medium text-[color:var(--color-brand-strong)]" aria-live="polite">
        {ctaMessage ?? ""}
      </p>

      <div className="grid grid-cols-6 auto-rows-[68px] gap-2 sm:auto-rows-[84px]" data-hero-intro="gallery">
        {featuredImages.map((image, index) => (
          <motion.article
            key={image.id}
            className={`group relative overflow-hidden rounded-[0.95rem] bg-[#f3e2d8] text-left shadow-[0_8px_18px_rgba(85,39,54,0.1)] ${
              tileClasses[index] ?? "col-span-2 row-span-1"
            }`}
            initial={reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={buildSoftRevealTransition(reduceMotion, 0.1 + index * 0.05)}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={index < 2}
              sizes={index === 0 ? "(max-width: 640px) 66vw, 420px" : "(max-width: 640px) 36vw, 260px"}
              className="motion-safe-scale object-cover object-center brightness-[1.02]"
            />
            {index < 2 ? (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2.5 pb-2 pt-8 text-[0.76rem] font-semibold text-white/95">
                {image.caption}
              </span>
            ) : null}
          </motion.article>
        ))}
      </div>
    </motion.section>
  );
}
