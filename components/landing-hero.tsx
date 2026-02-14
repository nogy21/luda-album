"use client";

import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import {
  LANDING_INTRO_SESSION_KEY,
  markHeroIntroSeen,
  shouldRunHeroIntro,
} from "@/lib/ui/hero-intro";

export function LandingHero() {
  const rootRef = useRef<HTMLElement | null>(null);

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

  return (
    <section
      ref={rootRef}
      className="mx-auto flex min-h-screen w-full max-w-[860px] flex-col justify-center px-4 py-8 sm:px-6"
    >
      <header className="mb-3 flex items-center justify-between" data-landing-intro="top">
        <p className="rounded-full border border-[color:var(--color-line)] bg-white px-3 py-1 text-[0.73rem] font-semibold text-[color:var(--color-muted)]">
          가족 전용 앨범
        </p>
        <Link
          href="/photos"
          className="inline-flex min-h-11 items-center rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 text-sm font-semibold text-[color:var(--color-muted)]"
        >
          사진 바로가기
        </Link>
      </header>

      <article className="overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)] p-4 shadow-[var(--shadow-float)] sm:p-6">
        <div className="max-w-[32rem] space-y-2">
          <h1
            data-landing-intro="title"
            className="text-[clamp(1.8rem,6vw,2.8rem)] font-bold leading-[1.15] tracking-[-0.02em] text-[color:var(--color-ink)]"
          >
            루다의 오늘
          </h1>
          <p
            data-landing-intro="value"
            className="text-[1rem] leading-[1.6] text-[color:var(--color-muted)]"
          >
            가족과 함께 성장 순간을 기록해요
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5" data-landing-intro="actions">
          <Link
            href="/photos#gallery"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(233,106,141,0.3)]"
          >
            이번 달 사진 보기
          </Link>
          <Link
            href="/photos#monthly-archive"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[color:var(--color-ink)]"
          >
            루다 성장 타임라인 보기
          </Link>
        </div>

        <div
          className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3"
          data-landing-intro="featured"
          aria-label="대표 추억 사진"
        >
          <div className="relative col-span-2 overflow-hidden rounded-[1rem] bg-[#f3e2d8]">
            <Image
              src="/luda.jpg"
              alt="한복을 입은 루다 대표 사진"
              width={1200}
              height={900}
              priority
              sizes="(max-width: 640px) 66vw, 520px"
              className="aspect-[4/3] w-full object-cover"
            />
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-10 text-xs font-semibold text-white">
              오늘의 대표컷
            </p>
          </div>
          <div className="space-y-2.5">
            <div className="relative overflow-hidden rounded-[1rem] bg-[#f3e2d8]">
              <Image
                src="/20260208_173853.jpg"
                alt="웃고 있는 루다"
                width={680}
                height={680}
                sizes="(max-width: 640px) 30vw, 220px"
                className="aspect-square w-full object-cover"
              />
            </div>
            <div className="rounded-[1rem] border border-[color:var(--color-line)] bg-white px-3 py-2 text-[0.78rem] leading-[1.45] text-[color:var(--color-muted)]">
              사진 탐색 속도와 회상 경험을 함께
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
