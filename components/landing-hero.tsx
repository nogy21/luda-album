"use client";

import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

import { getLatestDateItems } from "@/lib/gallery/featured";
import type { PhotoItem } from "@/lib/gallery/types";
import {
  LANDING_INTRO_SESSION_KEY,
  markHeroIntroSeen,
  shouldRunHeroIntro,
} from "@/lib/ui/hero-intro";

type LandingHeroProps = {
  items: PhotoItem[];
};

const buildDayLink = (takenAt: string) => {
  const date = new Date(takenAt);
  return `/photos?year=${date.getUTCFullYear()}&month=${date.getUTCMonth() + 1}&day=${date.getUTCDate()}`;
};

export function LandingHero({ items }: LandingHeroProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const highlightItems = useMemo(() => getLatestDateItems(items, 3), [items]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  if (highlightItems.length === 0) {
    return null;
  }

  const singleImage = highlightItems.length === 1;

  return (
    <section
      ref={rootRef}
      className="layout-container mt-2 sm:mt-3"
      aria-label="루다 하이라이트"
    >
      <article className="ui-surface overflow-hidden rounded-[var(--radius-xl)] p-3.5 sm:p-4">
        <p className="ui-eyebrow" data-landing-intro="meta">
          Luda Highlight
        </p>

        <h1
          data-landing-intro="title"
          className="mt-1.5 max-w-[18ch] text-[length:var(--text-display)] font-bold leading-[var(--leading-tight)] tracking-[-0.02em] text-[color:var(--color-ink)]"
        >
          루다 하이라이트
        </h1>

        <div
          className={`mt-3 grid gap-1.5 ${singleImage ? "grid-cols-1" : "grid-cols-3"}`}
          data-landing-intro="gallery"
        >
          {highlightItems.map((item) => (
            <Link
              key={item.id}
              href={buildDayLink(item.takenAt)}
              className="group relative overflow-hidden rounded-[0.88rem] bg-[color:var(--color-surface)] text-left"
              aria-label={`${item.caption} 날짜 앨범으로 이동`}
            >
              <Image
                src={item.thumbSrc ?? item.src}
                alt={item.alt}
                width={1000}
                height={1000}
                priority
                sizes={singleImage ? "(max-width: 860px) 92vw, 760px" : "(max-width: 640px) 31vw, 220px"}
                className={`motion-safe-scale w-full object-cover ${singleImage ? "aspect-[5/4]" : "aspect-square"}`}
              />
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/52 to-transparent px-2.5 pb-2 pt-7 text-[0.72rem] font-semibold text-white/95">
                {item.caption}
              </p>
            </Link>
          ))}
        </div>
      </article>
    </section>
  );
}
