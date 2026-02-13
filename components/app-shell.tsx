"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";

import {
  getInitialFeaturedImages,
  getShuffledFeaturedImages,
} from "@/lib/gallery/featured";
import { galleryImages } from "@/lib/gallery/images";

type AppShellProps = {
  children: ReactNode;
};

const tabs = [
  { href: "/photos", label: "사진" },
  { href: "/guestbook", label: "덕담" },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const safeBottomPadding = "max(0.75rem, env(safe-area-inset-bottom))";

  return (
    <div className="min-h-screen pb-[7.2rem]">
      <a
        href="#main-content"
        className="absolute left-3 top-3 z-50 -translate-y-24 rounded-full bg-[color:var(--color-brand)] px-3 py-2 text-sm font-semibold text-white transition focus-visible:translate-y-0"
      >
        본문으로 건너뛰기
      </a>
      <header
        className="sticky top-0 z-40 border-b border-[color:var(--color-line)]/45 bg-[color:var(--color-surface)]/88 px-4 pb-3 backdrop-blur-xl sm:px-6"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="mx-auto flex w-full max-w-[780px] items-center justify-between gap-3">
          <Link href="/photos" className="tracking-[-0.015em] text-[1.06rem] font-semibold text-[color:var(--color-ink)]">
            Luda Album
          </Link>
          <div className="rounded-full border border-[color:var(--color-line)]/55 bg-[color:var(--color-surface-strong)] px-2.5 py-1 text-[0.72rem] font-semibold tracking-[0.04em] text-[color:var(--color-muted)]">
            MOBILE ALBUM
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-[780px] px-4 pt-4 sm:px-6 sm:pt-5">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pt-2 sm:px-6" style={{ paddingBottom: safeBottomPadding }}>
        <div className="mx-auto grid w-full max-w-[780px] grid-cols-2 gap-2 rounded-2xl border border-[color:var(--color-line)]/45 bg-[color:var(--color-surface-strong)]/95 p-2 text-sm shadow-[var(--shadow-card)] backdrop-blur-xl">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative min-h-11 rounded-xl px-3 py-2.5 text-center text-[0.95rem] font-semibold transition-colors ${isActive
                  ? "bg-[color:var(--color-brand)] text-white shadow-[0_8px_18px_rgba(178,76,50,0.34)]"
                  : "text-[color:var(--color-muted)] hover:bg-[color:var(--color-brand-soft)]/55 active:bg-[color:var(--color-brand-soft)]/75"
                  }`}
              >
                {tab.label}
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-1 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-white/85"
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
  const tileClasses = useMemo(
    () => [
      "col-span-2 row-span-2",
      "col-span-2 row-span-1",
      "col-span-1 row-span-1",
      "col-span-1 row-span-1",
      "col-span-2 row-span-1",
    ],
    [],
  );

  return (
    <section className="enter-fade-up mb-5 overflow-hidden rounded-[1.6rem] border border-[color:var(--color-line)]/45 bg-[color:var(--color-surface-strong)] p-3.5 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
            Memories
          </p>
          <h2 className="mt-0.5 text-[1.18rem] font-bold tracking-[-0.015em] text-[color:var(--color-ink)] sm:text-[1.28rem]">
            오늘의 루다 셔플
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setFeaturedImages(getShuffledFeaturedImages(galleryImages))}
          className="min-h-11 rounded-full border border-[color:var(--color-line)]/55 bg-[color:var(--color-surface)] px-3.5 text-xs font-semibold text-[color:var(--color-muted)] transition-colors hover:bg-[color:var(--color-brand-soft)]/45"
        >
          새로 섞기
        </button>
      </div>

      <div className="grid grid-cols-4 auto-rows-[74px] gap-2.5 sm:auto-rows-[88px]">
        {featuredImages.map((image, index) => (
          <article
            key={image.id}
            className={`group relative overflow-hidden rounded-xl bg-[#eadcca] text-left shadow-[0_6px_14px_rgba(45,27,19,0.06)] ${
              tileClasses[index] ?? "col-span-2 row-span-1"
            }`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={index < 2}
              sizes={index === 0 ? "(max-width: 640px) 58vw, 360px" : "(max-width: 640px) 40vw, 260px"}
              className="object-cover object-center transition duration-300 group-hover:scale-[1.03]"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/58 to-transparent px-2.5 pb-2 pt-6 text-[0.7rem] font-semibold text-white/92">
              {image.caption}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
