"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { PhotoItem } from "@/lib/gallery/types";
import {
  addFullscreenChangeListener,
  canUseFullscreen,
  exitFullscreen,
  getFullscreenElement,
  isFullscreenSupported,
  requestFullscreen,
} from "@/lib/ui/fullscreen";
import { lockPageScroll, unlockPageScroll } from "@/lib/ui/scroll-lock";

type LandingRecentSectionProps = {
  items: PhotoItem[];
};

const buildDayLink = (takenAt: string) => {
  const date = new Date(takenAt);
  return `/photos?year=${date.getUTCFullYear()}&month=${date.getUTCMonth() + 1}&day=${date.getUTCDate()}`;
};

const formatDateLabel = (takenAt: string) => {
  const date = new Date(takenAt);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export function LandingRecentSection({ items }: LandingRecentSectionProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isLightboxFullscreen, setIsLightboxFullscreen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const lightboxFrameRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  const previewItems = items.slice(0, 3);
  const selectedImage = lightboxIndex !== null ? previewItems[lightboxIndex] ?? null : null;

  const closeLightbox = useCallback(() => {
    const restoreFocus = () => {
      setLightboxIndex(null);
      setIsLightboxFullscreen(false);
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    };

    const target = lightboxFrameRef.current;

    if (target && getFullscreenElement() === target) {
      void exitFullscreen().catch(() => {}).finally(restoreFocus);
      return;
    }

    restoreFocus();
  }, []);

  const moveLightbox = useCallback((step: number) => {
    setLightboxIndex((current) => {
      if (current === null) {
        return current;
      }

      return (current + step + previewItems.length) % previewItems.length;
    });
  }, [previewItems.length]);

  const toggleLightboxFullscreen = useCallback(() => {
    if (!selectedImage) {
      return;
    }

    const target = lightboxFrameRef.current;

    if (!canUseFullscreen(target)) {
      window.open(selectedImage.src, "_blank", "noopener,noreferrer");
      return;
    }

    if (getFullscreenElement() === target) {
      void exitFullscreen().catch(() => {});
      return;
    }

    void requestFullscreen(target).catch(() => {});
  }, [selectedImage]);

  useEffect(() => {
    if (!selectedImage) {
      return;
    }

    const snapshot = lockPageScroll();

    return () => {
      unlockPageScroll(snapshot);
    };
  }, [selectedImage]);

  useEffect(() => {
    if (!selectedImage) {
      return;
    }

    const syncFullscreenState = () => {
      const target = lightboxFrameRef.current;
      const activeElement = getFullscreenElement();
      setIsLightboxFullscreen(Boolean(target && activeElement === target));
    };

    syncFullscreenState();

    return addFullscreenChangeListener(syncFullscreenState);
  }, [selectedImage]);

  useEffect(() => {
    if (!selectedImage) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const target = lightboxFrameRef.current;

        if (target && getFullscreenElement() === target) {
          event.preventDefault();
          void exitFullscreen().catch(() => {});
          return;
        }

        closeLightbox();
        return;
      }

      if (event.key === "ArrowLeft") {
        moveLightbox(-1);
      }

      if (event.key === "ArrowRight") {
        moveLightbox(1);
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleLightboxFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedImage, closeLightbox, moveLightbox, toggleLightboxFullscreen]);

  if (previewItems.length === 0) {
    return null;
  }

  const supportsLightboxFullscreen = selectedImage ? isFullscreenSupported() : false;

  return (
    <section className="layout-container mt-[var(--space-section-sm)]">
      <div className="ui-surface rounded-[var(--radius-lg)] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="ui-title">요즘 루다는</h2>
          <Link href="/photos" className="ui-btn ui-btn-secondary px-3">
            전체 보기
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {previewItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setLightboxIndex(index);
              }}
              className="group relative overflow-hidden rounded-[0.8rem] bg-[color:var(--color-surface)] text-left"
              aria-label={`${item.caption} 확대 보기`}
            >
              <Image
                src={item.thumbSrc ?? item.src}
                alt={item.alt}
                width={280}
                height={280}
                sizes="(max-width: 640px) 24vw, 180px"
                className="motion-safe-scale aspect-square w-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedImage ? (
          <motion.div
            className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-black/86 p-3"
            role="dialog"
            aria-modal="true"
            aria-label="요즘 루다 사진"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeLightbox();
              }
            }}
          >
            <motion.div
              ref={lightboxFrameRef}
              className="w-full max-w-3xl overflow-hidden rounded-[1.2rem] border border-white/10 bg-black"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 6, scale: 0.985 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            >
              <Image
                src={selectedImage.src}
                alt={selectedImage.alt}
                width={1200}
                height={1400}
                sizes="(max-width: 860px) 92vw, 760px"
                className="max-h-[78vh] w-full object-contain"
                priority
              />
              <div className="space-y-2.5 border-t border-white/10 bg-black/90 px-3 py-3">
                <div>
                  <p className="text-[0.88rem] font-semibold text-white/96">{selectedImage.caption}</p>
                  <p className="text-[0.73rem] text-white/74">{formatDateLabel(selectedImage.takenAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={buildDayLink(selectedImage.takenAt)} className="ui-btn ui-btn-primary px-4">
                    이동하기
                  </Link>
                  {previewItems.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => moveLightbox(-1)}
                        className="ui-btn border-white/26 bg-white/10 px-3 text-white hover:bg-white/16"
                        aria-label="이전 사진"
                      >
                        이전
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLightbox(1)}
                        className="ui-btn border-white/26 bg-white/10 px-3 text-white hover:bg-white/16"
                        aria-label="다음 사진"
                      >
                        다음
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={toggleLightboxFullscreen}
                    className="ui-btn border-white/26 bg-white/10 px-3 text-white hover:bg-white/16"
                  >
                    {isLightboxFullscreen
                      ? "전체화면 종료"
                      : supportsLightboxFullscreen
                        ? "전체화면"
                        : "새 탭으로 보기"}
                  </button>
                  <button
                    type="button"
                    onClick={closeLightbox}
                    className="ui-btn border-white/26 bg-white/10 px-4 text-white hover:bg-white/16"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
