"use client";

import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { groupGalleryImagesByMonth } from "@/lib/gallery/grouping";
import { type GalleryImage, galleryImages } from "@/lib/gallery/images";
import { lockPageScroll, unlockPageScroll } from "@/lib/ui/scroll-lock";

gsap.registerPlugin(ScrollTrigger);

const HIGHLIGHT_COUNT = 6;
const ARCHIVE_BATCH_SIZE = 12;

const sortByTakenAtDesc = (a: GalleryImage, b: GalleryImage) => {
  return +new Date(b.takenAt) - +new Date(a.takenAt);
};

const formatDateLabel = (takenAt: string) => {
  const date = new Date(takenAt);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

type GallerySectionProps = {
  images?: GalleryImage[];
};

export function GallerySection({ images = galleryImages }: GallerySectionProps) {
  const sortedImages = useMemo(() => [...images].sort(sortByTakenAtDesc), [images]);
  const highlights = useMemo(() => sortedImages.slice(0, HIGHLIGHT_COUNT), [sortedImages]);
  const monthGroups = useMemo(() => groupGalleryImagesByMonth(sortedImages), [sortedImages]);

  const [openMonthKeys, setOpenMonthKeys] = useState<string[]>(() =>
    monthGroups[0] ? [monthGroups[0].key] : [],
  );
  const [visibleCountByMonth, setVisibleCountByMonth] = useState<Record<string, number>>(() =>
    Object.fromEntries(monthGroups.map((group) => [group.key, ARCHIVE_BATCH_SIZE])),
  );
  const [lightbox, setLightbox] = useState<{ items: GalleryImage[]; index: number } | null>(null);
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const lightboxPanelRef = useRef<HTMLDivElement | null>(null);
  const lightboxImageRef = useRef<HTMLDivElement | null>(null);
  const portalRoot = typeof document === "undefined" ? null : document.body;
  const monthJumpScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!lightbox) {
      return;
    }

    const snapshot = lockPageScroll();

    return () => {
      unlockPageScroll(snapshot);
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
  const latestUpdatedLabel = monthGroups[0]?.updatedLabel ?? "업데이트 정보 없음";

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const monthKey = entry.target.getAttribute("data-month-key");

          if (!monthKey) {
            return;
          }

          const group = monthGroups.find((item) => item.key === monthKey);
          const visible = visibleCountByMonth[monthKey] ?? ARCHIVE_BATCH_SIZE;
          const isOpen = openMonthKeys.includes(monthKey);

          if (!group || !isOpen) {
            return;
          }

          if (group.items.length > visible) {
            loadMore(monthKey);
          }
        });
      },
      { rootMargin: "180px 0px" },
    );

    const sentinels = document.querySelectorAll<HTMLElement>("[data-month-sentinel]");
    sentinels.forEach((sentinel) => observer.observe(sentinel));

    return () => {
      observer.disconnect();
    };
  }, [monthGroups, openMonthKeys, visibleCountByMonth]);

  const jumpToMonth = (monthKey: string) => {
    const monthCard = document.getElementById(`archive-${monthKey}`);

    if (!monthCard) {
      return;
    }

    monthCard.scrollIntoView({
      block: "start",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const section = sectionRef.current;

    if (!section) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        section,
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.48,
          ease: "power2.out",
          scrollTrigger: {
            trigger: section,
            start: "top 88%",
            once: true,
          },
        },
      );

      const cards = section.querySelectorAll<HTMLElement>("[data-photo-card]");

      if (cards.length > 0) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 12, scale: 0.986 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.36,
            ease: "power2.out",
            stagger: 0.04,
            scrollTrigger: {
              trigger: section,
              start: "top 82%",
              once: true,
            },
          },
        );
      }
    }, section);

    return () => {
      context.revert();
    };
  }, [reduceMotion, images.length]);

  useEffect(() => {
    if (reduceMotion || !lightbox) {
      return;
    }

    const panel = lightboxPanelRef.current;
    const imageWrap = lightboxImageRef.current;

    if (!panel || !imageWrap) {
      return;
    }

    const timeline = gsap.timeline({ defaults: { ease: "power2.out" } });
    timeline
      .fromTo(panel, { opacity: 0, scale: 0.965, y: 14 }, { opacity: 1, scale: 1, y: 0, duration: 0.26 })
      .fromTo(imageWrap, { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 0.24 }, "<0.03");

    return () => {
      timeline.kill();
    };
  }, [lightbox, lightbox?.index, reduceMotion]);

  const lightboxOverlay = selectedImage ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/88 p-3 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="갤러리 이미지 크게 보기"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeLightbox();
        }
      }}
    >
      <div ref={lightboxPanelRef} className="w-full max-w-3xl overflow-hidden rounded-[1.3rem] border border-white/15 bg-black">
        <div ref={lightboxImageRef}>
          <Image
            src={selectedImage.src}
            alt={selectedImage.alt}
            width={1000}
            height={1200}
            sizes="(max-width: 768px) 92vw, 760px"
            className="max-h-[78vh] w-full object-contain"
            priority
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/90 px-3 py-2.5 text-white">
          <div>
            <p className="line-clamp-1 text-sm font-semibold text-white/95">{selectedImage.caption}</p>
            <p className="text-[0.72rem] text-white/70">{formatDateLabel(selectedImage.takenAt)}</p>
          </div>
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
  ) : null;

  return (
    <>
      <section
        ref={sectionRef}
        id="gallery"
        className="scroll-mt-24 w-full rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)] p-3.5 shadow-[var(--shadow-soft)] sm:p-4.5"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[length:var(--text-section-title)] font-bold leading-tight text-[color:var(--color-ink)]">
              사진 모아보기
            </h2>
            <p className="mt-1 text-[0.86rem] text-[color:var(--color-muted)]">대표 컷과 월별 사진</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[0.74rem] font-semibold text-[color:var(--color-brand-strong)]">
            <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-brand-soft)] px-2.5 py-1">
              총 {images.length}장
            </span>
            <span className="rounded-full border border-[color:var(--color-line)] bg-white px-2.5 py-1">
              {latestUpdatedLabel}
            </span>
          </div>
        </div>

        <section className="mb-4 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 shadow-[0_10px_24px_rgba(147,72,96,0.08)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[1rem] font-semibold text-[color:var(--color-ink)]">최근 하이라이트</h3>
            <span className="text-[0.74rem] font-semibold text-[color:var(--color-muted)]">
              최근 {highlights.length}장
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {highlights.map((image, index) => (
              <button
                key={image.id}
                data-photo-card
                type="button"
                onClick={(event) => openLightbox(highlights, index, event.currentTarget)}
                className={`group relative overflow-hidden rounded-[0.92rem] bg-[#f3e2d8] text-left shadow-[0_7px_16px_rgba(85,39,54,0.1)] ${
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
                  className={`motion-safe-scale w-full object-cover ${
                    index === 0 ? "aspect-[16/11]" : "aspect-square"
                  }`}
                  priority={index < 2}
                />
                {index <= 1 ? (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2.5 pb-2.5 pt-8 text-[0.74rem] font-semibold text-white/95">
                    {image.caption}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2.5">
          <div id="monthly-archive" className="space-y-2">
            <h3 className="text-[1rem] font-semibold text-[color:var(--color-ink)]">월별 아카이브</h3>
            <div
              ref={monthJumpScrollRef}
              className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="월별 빠른 이동"
            >
              {monthGroups.map((group) => (
                <button
                  key={`${group.key}-jump`}
                  type="button"
                  onClick={() => jumpToMonth(group.key)}
                  className="shrink-0 rounded-full border border-[color:var(--color-line)] bg-white px-3 py-1.5 text-[0.72rem] font-semibold text-[color:var(--color-muted)] transition-colors hover:bg-[color:var(--color-brand-soft)]"
                >
                  {group.label}
                </button>
              ))}
            </div>
          </div>

          {monthGroups.map((group) => {
            const open = isMonthOpen(group.key);
            const visibleItems = getVisibleItems(group.key, group.items);

            return (
              <article
                key={group.key}
                id={`archive-${group.key}`}
                data-photo-card
                 className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] shadow-[0_8px_20px_rgba(147,72,96,0.08)]"
              >
                <button
                  type="button"
                  onClick={() => toggleMonth(group.key)}
                  aria-expanded={open}
                  className="flex min-h-[3.1rem] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
                >
                  <div>
                    <p className="text-[0.98rem] font-semibold text-[color:var(--color-ink)]">{group.label}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.72rem] font-medium text-[color:var(--color-muted)]">
                      <span className="rounded-full border border-[color:var(--color-line)] bg-white px-2 py-0.5">
                        {group.items.length}장의 기록
                      </span>
                      <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-brand-soft)] px-2 py-0.5 text-[color:var(--color-brand-strong)]">
                        {group.updatedLabel}
                      </span>
                    </div>
                  </div>
                  <span className="text-base font-semibold text-[color:var(--color-muted)]">
                    {open ? "−" : "+"}
                  </span>
                </button>

                {open ? (
                  <div className="space-y-2.5 border-t border-[color:var(--color-line)] p-3">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      {visibleItems.map((image, index) => (
                        <button
                          key={image.id}
                          data-photo-card
                          type="button"
                          onClick={(event) => openLightbox(group.items, index, event.currentTarget)}
                          className="group relative overflow-hidden rounded-[0.9rem] bg-[#f3e2d8] text-left shadow-[0_7px_15px_rgba(85,39,54,0.1)]"
                          aria-label={`${image.caption} 확대 보기`}
                        >
                          <Image
                            src={image.src}
                            alt={image.alt}
                            width={420}
                            height={560}
                            sizes="(max-width: 767px) 50vw, (max-width: 1024px) 33vw, 280px"
                            className="motion-safe-scale aspect-square w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>

                    {hasMoreItems(group.key, group.items.length) ? (
                      <>
                        <div data-month-sentinel data-month-key={group.key} className="h-1 w-full" />
                        <button
                          type="button"
                          onClick={() => loadMore(group.key)}
                          className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 py-2 text-[0.82rem] font-semibold text-[color:var(--color-muted)] transition-colors hover:bg-[color:var(--color-brand-soft)]"
                        >
                          더 불러오기
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </section>
      {portalRoot && lightboxOverlay ? createPortal(lightboxOverlay, portalRoot) : null}
    </>
  );
}
