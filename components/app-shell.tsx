"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useMemo, useState } from "react";

import {
  getInitialFeaturedImages,
  getShuffledFeaturedImages,
} from "@/lib/gallery/featured";
import { galleryImages } from "@/lib/gallery/images";
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

export function CoverCard() {
  const [featuredImages, setFeaturedImages] = useState(() =>
    getInitialFeaturedImages(galleryImages),
  );
  const shouldReduceMotion = useReducedMotion();
  const reduceMotion = !!shouldReduceMotion;
  const tileClasses = useMemo(
    () => [
      "col-span-4 row-span-3",
      "col-span-2 row-span-2",
      "col-span-2 row-span-1",
      "col-span-3 row-span-2",
      "col-span-3 row-span-2",
    ],
    [],
  );

  return (
    <motion.section
      className="mb-4 overflow-hidden rounded-[1.5rem] border border-[color:var(--color-line)]/42 bg-[color:var(--color-surface-strong)] p-3.5 shadow-[var(--shadow-float)] sm:p-4.5"
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={buildSoftRevealTransition(reduceMotion, 0.04)}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <header>
          <p className="text-[0.69rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-brand)]">
            Today Album
          </p>
          <h2 className="mt-0.5 text-[length:var(--text-title)] font-bold tracking-[-0.018em] text-[color:var(--color-ink)]">
            루다 포토 하이라이트
          </h2>
        </header>
        <button
          type="button"
          onClick={() => setFeaturedImages(getShuffledFeaturedImages(galleryImages))}
          className="min-h-11 rounded-full border border-[color:var(--color-line)]/45 bg-[color:var(--color-surface)] px-3.5 text-[0.8rem] font-semibold text-[color:var(--color-muted)] transition-colors hover:bg-[color:var(--color-brand-soft)]/58"
        >
          새로 섞기
        </button>
      </div>

      <div className="grid grid-cols-6 auto-rows-[74px] gap-2 sm:auto-rows-[88px]">
        {featuredImages.map((image, index) => (
          <motion.article
            key={image.id}
            className={`group relative overflow-hidden rounded-[0.95rem] bg-[#eadcca] text-left shadow-[0_8px_18px_rgba(45,27,19,0.08)] ${
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
            {index === 0 ? (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-2 pt-8 text-[0.78rem] font-semibold text-white/94">
                {image.caption}
              </span>
            ) : null}
          </motion.article>
        ))}
      </div>
    </motion.section>
  );
}
