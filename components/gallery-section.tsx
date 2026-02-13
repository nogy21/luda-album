"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { groupGalleryImagesByMonth } from "@/lib/gallery/grouping";
import { type GalleryImage, galleryImages } from "@/lib/gallery/images";

const HIGHLIGHT_COUNT = 6;
const ARCHIVE_BATCH_SIZE = 12;

const sortByTakenAtDesc = (a: GalleryImage, b: GalleryImage) => {
  return +new Date(b.takenAt) - +new Date(a.takenAt);
};

export function GallerySection() {
  const sortedImages = useMemo(() => [...galleryImages].sort(sortByTakenAtDesc), []);
  const highlights = useMemo(() => sortedImages.slice(0, HIGHLIGHT_COUNT), [sortedImages]);
  const monthGroups = useMemo(() => groupGalleryImagesByMonth(sortedImages), [sortedImages]);

  const [openMonthKeys, setOpenMonthKeys] = useState<string[]>(() =>
    monthGroups[0] ? [monthGroups[0].key] : [],
  );
  const [visibleCountByMonth, setVisibleCountByMonth] = useState<Record<string, number>>(() =>
    Object.fromEntries(monthGroups.map((group) => [group.key, ARCHIVE_BATCH_SIZE])),
  );
  const [lightbox, setLightbox] = useState<{ items: GalleryImage[]; index: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!lightbox) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lightbox]);

  useEffect(() => {
    if (!lightbox) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightbox(null);
        window.requestAnimationFrame(() => {
          triggerRef.current?.focus();
        });
        return;
      }

      if (event.key === "ArrowLeft") {
        setLightbox((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            index: (current.index - 1 + current.items.length) % current.items.length,
          };
        });
      }

      if (event.key === "ArrowRight") {
        setLightbox((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            index: (current.index + 1) % current.items.length,
          };
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightbox]);

  const selectedImage = lightbox ? lightbox.items[lightbox.index] : null;

  const openLightbox = (
    items: GalleryImage[],
    index: number,
    triggerElement: HTMLButtonElement,
  ) => {
    triggerRef.current = triggerElement;
    setLightbox({ items, index });
  };

  const closeLightbox = () => {
    setLightbox(null);
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  };

  const showPrevious = () => {
    setLightbox((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        index: (current.index - 1 + current.items.length) % current.items.length,
      };
    });
  };

  const showNext = () => {
    setLightbox((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        index: (current.index + 1) % current.items.length,
      };
    });
  };

  const isMonthOpen = (key: string) => {
    return openMonthKeys.includes(key);
  };

  const toggleMonth = (key: string) => {
    setOpenMonthKeys((current) =>
      current.includes(key) ? current.filter((monthKey) => monthKey !== key) : [...current, key],
    );
  };

  const loadMore = (monthKey: string) => {
    setVisibleCountByMonth((current) => ({
      ...current,
      [monthKey]: (current[monthKey] ?? ARCHIVE_BATCH_SIZE) + ARCHIVE_BATCH_SIZE,
    }));
  };

  const getVisibleItems = (monthKey: string, items: GalleryImage[]) => {
    const visible = visibleCountByMonth[monthKey] ?? ARCHIVE_BATCH_SIZE;
    return items.slice(0, visible);
  };

  const hasMoreItems = (monthKey: string, totalCount: number) => {
    const visible = visibleCountByMonth[monthKey] ?? ARCHIVE_BATCH_SIZE;
    return totalCount > visible;
  };

  return (
    <section
      id="gallery"
      className="enter-fade-up enter-delay-1 scroll-mt-24 w-full rounded-[1.5rem] border border-[color:var(--color-line)]/45 bg-[color:var(--color-surface-strong)] p-3.5 shadow-[var(--shadow-soft)] sm:p-5"
    >
      <div className="mb-5 flex items-end justify-between gap-2 px-1">
        <div>
          <h2 className="text-[1.35rem] font-bold leading-tight text-[color:var(--color-ink)]">
            사진 모아보기
          </h2>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            주요 사진부터 월별 아카이브까지 빠르게 탐색
          </p>
        </div>
        <p className="rounded-full bg-[color:var(--color-brand-soft)]/70 px-3 py-1 text-xs font-semibold text-[color:var(--color-brand)]">
          총 {galleryImages.length}장
        </p>
      </div>

      <section className="mb-5 rounded-2xl border border-[color:var(--color-line)]/35 bg-[color:var(--color-surface)] p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[color:var(--color-ink)]">하이라이트</h3>
          <span className="text-xs font-semibold text-[color:var(--color-muted)]">
            최근 {highlights.length}장
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {highlights.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={(event) => openLightbox(highlights, index, event.currentTarget)}
                className={`group relative overflow-hidden rounded-xl bg-[#eadcca] text-left shadow-[0_6px_14px_rgba(45,27,19,0.06)] ${
                  index === 0 ? "col-span-2" : ""
                }`}
              aria-label={`${image.caption} 확대 보기`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={index === 0 ? 1024 : 420}
                height={index === 0 ? 640 : 560}
                sizes={
                  index === 0
                    ? "(max-width: 767px) 100vw, 760px"
                    : "(max-width: 767px) 50vw, (max-width: 1024px) 33vw, 280px"
                }
                className={`w-full object-cover transition duration-300 group-hover:scale-[1.03] ${
                  index === 0 ? "aspect-[16/10]" : "aspect-[3/4]"
                }`}
                priority={index < 2}
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-2.5 pt-8 text-xs font-semibold text-white/95">
                {image.caption}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="px-1 text-lg font-semibold text-[color:var(--color-ink)]">월별 아카이브</h3>

        {monthGroups.map((group) => {
          const open = isMonthOpen(group.key);
          const visibleItems = getVisibleItems(group.key, group.items);

          return (
            <article
              key={group.key}
              className="overflow-hidden rounded-2xl border border-[color:var(--color-line)]/35 bg-[color:var(--color-surface)]"
            >
              <button
                type="button"
                onClick={() => toggleMonth(group.key)}
                aria-expanded={open}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div>
                  <p className="text-base font-semibold text-[color:var(--color-ink)]">{group.label}</p>
                  <p className="text-xs text-[color:var(--color-muted)]">{group.items.length}장의 기록</p>
                </div>
                <span className="text-lg font-semibold text-[color:var(--color-muted)]">
                  {open ? "−" : "+"}
                </span>
              </button>

              {open ? (
                <div
                  className="space-y-3 border-t border-[color:var(--color-line)]/25 p-3.5"
                  style={{ contentVisibility: "auto", containIntrinsicSize: "680px" }}
                >
                  <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                    {visibleItems.map((image, index) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={(event) => openLightbox(group.items, index, event.currentTarget)}
                        className="group relative overflow-hidden rounded-xl bg-[#eadcca] text-left shadow-[0_6px_14px_rgba(45,27,19,0.06)]"
                        aria-label={`${image.caption} 확대 보기`}
                      >
                        <Image
                          src={image.src}
                          alt={image.alt}
                          width={420}
                          height={560}
                          sizes="(max-width: 767px) 50vw, (max-width: 1024px) 33vw, 280px"
                          className="aspect-[3/4] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      </button>
                    ))}
                  </div>

                  {hasMoreItems(group.key, group.items.length) ? (
                    <button
                      type="button"
                      onClick={() => loadMore(group.key)}
                       className="min-h-11 rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 text-sm font-semibold text-[color:var(--color-muted)] transition-colors hover:bg-[color:var(--color-brand-soft)]/35"
                     >
                       더 불러오기
                     </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
      {selectedImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/85 p-3 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="갤러리 이미지 크게 보기"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeLightbox();
            }
          }}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-black">
            <Image
              src={selectedImage.src}
              alt={selectedImage.alt}
              width={1000}
              height={1200}
              sizes="(max-width: 768px) 92vw, 760px"
              className="max-h-[78vh] w-full object-contain"
              priority
            />
            <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/90 px-3 py-2.5 text-white">
              <p className="line-clamp-1 text-sm font-medium text-white/90">{selectedImage.caption}</p>
              <div className="flex items-center gap-1.5">
                {lightbox && lightbox.items.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={showPrevious}
                      className="min-h-11 min-w-11 rounded-full bg-white/15 px-3 text-lg font-semibold text-white"
                      aria-label="이전 사진"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={showNext}
                      className="min-h-11 min-w-11 rounded-full bg-white/15 px-3 text-lg font-semibold text-white"
                      aria-label="다음 사진"
                    >
                      ›
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={closeLightbox}
                  className="min-h-11 rounded-full bg-white/20 px-4 text-sm font-semibold text-white"
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
