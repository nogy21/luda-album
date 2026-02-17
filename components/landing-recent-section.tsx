"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { PhotoItem } from "@/lib/gallery/types";
import { usePhotoGestures } from "@/lib/ui/photo-gestures";
import { usePhotoViewerMode } from "@/lib/ui/photo-viewer-mode";
import { lockPageScroll, unlockPageScroll } from "@/lib/ui/scroll-lock";

type LandingRecentSectionProps = {
  items: PhotoItem[];
};

const IMMERSIVE_GESTURE_HINT_KEY = "luda:photo-viewer:gesture-hint:v1";

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
  const [lightboxDirection, setLightboxDirection] = useState<-1 | 0 | 1>(0);
  const [isGestureHintDismissed, setIsGestureHintDismissed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const lightboxImmersiveRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  const previewItems = items.slice(0, 3);
  const previewItemCount = previewItems.length;
  const selectedImage = lightboxIndex !== null ? previewItems[lightboxIndex] ?? null : null;

  const moveLightbox = useCallback(
    (step: number) => {
      setLightboxDirection(step > 0 ? 1 : -1);
      setLightboxIndex((current) => {
        if (current === null) {
          return current;
        }

        return (current + step + previewItemCount) % previewItemCount;
      });
    },
    [previewItemCount],
  );

  const {
    isImmersive: isLightboxImmersive,
    isOverlayVisible,
    toggleImmersive: toggleLightboxFullscreen,
    exitImmersive: exitLightboxImmersive,
    showOverlayTemporarily,
  } = usePhotoViewerMode({
    frameRef: lightboxImmersiveRef,
    isOpen: Boolean(selectedImage),
    autoHideMs: 2200,
  });

  const {
    isZoomed: isLightboxZoomed,
    transformStyle: lightboxTransformStyle,
    bind: lightboxGestureBind,
    resetTransform: resetLightboxTransform,
  } = usePhotoGestures({
    enabled: Boolean(selectedImage && isLightboxImmersive),
    onNavigatePrev: previewItemCount > 1 ? () => moveLightbox(-1) : undefined,
    onNavigateNext: previewItemCount > 1 ? () => moveLightbox(1) : undefined,
  });

  const closeLightbox = useCallback(() => {
    setLightboxDirection(0);
    setLightboxIndex(null);
    void exitLightboxImmersive();
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [exitLightboxImmersive]);

  const dismissGestureHint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(IMMERSIVE_GESTURE_HINT_KEY, "seen");
    }

    setIsGestureHintDismissed(true);
  }, []);

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

    resetLightboxTransform();
  }, [isLightboxImmersive, resetLightboxTransform, selectedImage]);

  const shouldShowGestureHint =
    isLightboxImmersive &&
    !isGestureHintDismissed &&
    (typeof window === "undefined" ||
      window.localStorage.getItem(IMMERSIVE_GESTURE_HINT_KEY) !== "seen");

  useEffect(() => {
    if (!selectedImage || previewItemCount < 2 || lightboxIndex === null || typeof window === "undefined") {
      return;
    }

    const nextItem = previewItems[(lightboxIndex + 1) % previewItemCount];
    const prevItem = previewItems[(lightboxIndex - 1 + previewItemCount) % previewItemCount];
    const preloadTargets = Array.from(
      new Set(
        [
          nextItem?.thumbSrc ?? nextItem?.src,
          nextItem?.src,
          prevItem?.thumbSrc ?? prevItem?.src,
          prevItem?.src,
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    for (const target of preloadTargets) {
      const preloader = new window.Image();
      preloader.src = target;
    }
  }, [lightboxIndex, previewItemCount, previewItems, selectedImage]);

  useEffect(() => {
    if (!selectedImage) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isLightboxImmersive) {
          event.preventDefault();
          void exitLightboxImmersive();
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
        void toggleLightboxFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    closeLightbox,
    exitLightboxImmersive,
    isLightboxImmersive,
    moveLightbox,
    selectedImage,
    toggleLightboxFullscreen,
  ]);

  if (previewItems.length === 0) {
    return null;
  }

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
                setLightboxDirection(0);
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
                quality={62}
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
            className={`fixed inset-0 z-[var(--z-overlay)] flex bg-black/90 ${
              isLightboxImmersive
                ? "items-stretch justify-center p-0"
                : "items-center justify-center p-2 sm:p-3"
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="요즘 루다 사진"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                if (isLightboxImmersive) {
                  showOverlayTemporarily();
                  return;
                }

                closeLightbox();
              }
            }}
          >
            <motion.div
              className={
                isLightboxImmersive
                  ? "relative h-full w-full overflow-hidden bg-black"
                  : "w-full max-w-3xl overflow-hidden rounded-[1rem] border border-white/10 bg-black"
              }
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 6, scale: 0.985 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            >
              <div
                ref={lightboxImmersiveRef}
                className={`photo-viewer-immersive-target relative bg-black ${
                  isLightboxImmersive ? "h-full w-full touch-none" : "w-full"
                }`}
                onPointerDown={(event) => {
                  if (isLightboxImmersive) {
                    showOverlayTemporarily();
                    lightboxGestureBind.onPointerDown(event);
                  }
                }}
                onPointerMove={(event) => {
                  if (isLightboxImmersive) {
                    showOverlayTemporarily();
                    lightboxGestureBind.onPointerMove(event);
                  }
                }}
                onPointerUp={(event) => {
                  if (isLightboxImmersive) {
                    lightboxGestureBind.onPointerUp(event);
                  }
                }}
                onPointerCancel={(event) => {
                  if (isLightboxImmersive) {
                    lightboxGestureBind.onPointerCancel(event);
                  }
                }}
                onDoubleClick={(event) => {
                  if (isLightboxImmersive) {
                    lightboxGestureBind.onDoubleClick(event);
                  }
                }}
              >
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    key={selectedImage.id}
                    className="h-full w-full"
                    initial={
                      reduceMotion
                        ? false
                        : {
                            opacity: 0,
                            x: lightboxDirection === 0 ? 0 : lightboxDirection * 28,
                            scale: 0.996,
                          }
                    }
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={
                      reduceMotion
                        ? { opacity: 1 }
                        : {
                            opacity: 0,
                            x: lightboxDirection === 0 ? 0 : lightboxDirection * -28,
                            scale: 0.996,
                          }
                    }
                    transition={{
                      duration: reduceMotion ? 0 : 0.22,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <Image
                      src={selectedImage.src}
                      alt={selectedImage.alt}
                      width={1200}
                      height={1400}
                      sizes={isLightboxImmersive ? "100vw" : "(max-width: 860px) 92vw, 760px"}
                      className={`select-none object-contain ${
                        isLightboxImmersive ? "h-full w-full" : "max-h-[78vh] w-full"
                      }`}
                      quality={74}
                      fetchPriority="high"
                      style={isLightboxImmersive ? lightboxTransformStyle : undefined}
                      decoding="async"
                      draggable={false}
                      priority
                    />
                  </motion.div>
                </AnimatePresence>

                {isLightboxImmersive ? (
                  <div
                    className={`absolute inset-0 transition-opacity duration-200 ${
                      isOverlayVisible ? "opacity-100" : "pointer-events-none opacity-0"
                    }`}
                  >
                    <div className="absolute inset-x-0 top-0 flex items-center justify-end gap-1.5 px-2.5 py-[max(0.68rem,env(safe-area-inset-top))]">
                      <button
                        type="button"
                        onClick={() => void toggleLightboxFullscreen()}
                        className="ui-btn photo-viewer-control shrink-0 border-white/24 bg-black/56 px-2.5 text-[0.72rem] text-white hover:bg-black/68"
                      >
                        전체화면 종료
                      </button>
                      <button
                        type="button"
                        onClick={closeLightbox}
                        className="ui-btn photo-viewer-control shrink-0 border-white/24 bg-black/56 px-2.5 text-[0.72rem] text-white hover:bg-black/68"
                      >
                        닫기
                      </button>
                    </div>
                    {shouldShowGestureHint ? (
                      <div className="absolute inset-x-0 top-[max(3.2rem,calc(env(safe-area-inset-top)+2.8rem))] flex justify-center px-2.5">
                        <div className="max-w-[22rem] rounded-[0.9rem] border border-white/24 bg-black/66 px-3 py-2 text-white backdrop-blur-sm">
                          <p className="text-[0.76rem] font-semibold">제스처 안내</p>
                          <p className="mt-1 text-[0.72rem] leading-[1.45] text-white/90">
                            좌우로 밀면 다음 사진, 더블탭/핀치로 확대할 수 있어요.
                          </p>
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={dismissGestureHint}
                              className="ui-btn photo-viewer-control min-h-9 border-white/24 bg-white/10 px-2.5 text-[0.72rem] text-white hover:bg-white/20"
                            >
                              확인
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {previewItemCount > 1 ? (
                      <div className="absolute inset-x-0 bottom-[max(0.62rem,env(safe-area-inset-bottom))] flex justify-center px-2.5">
                        <div className="photo-viewer-control-row flex max-w-full items-center gap-1.5 rounded-full border border-white/18 bg-black/58 px-2 py-1.5 backdrop-blur-sm">
                          <button
                            type="button"
                            onClick={() => moveLightbox(-1)}
                            className="ui-btn photo-viewer-control shrink-0 border-white/24 bg-white/10 px-2.5 text-[0.72rem] text-white hover:bg-white/20"
                            aria-label="이전 사진"
                          >
                            이전
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLightbox(1)}
                            className="ui-btn photo-viewer-control shrink-0 border-white/24 bg-white/10 px-2.5 text-[0.72rem] text-white hover:bg-white/20"
                            aria-label="다음 사진"
                          >
                            다음
                          </button>
                          {isLightboxZoomed ? (
                            <span className="photo-viewer-control shrink-0 px-2 text-[0.68rem] font-semibold text-white/84">
                              확대됨
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {!isLightboxImmersive ? (
                <div className="space-y-1.5 border-t border-white/10 bg-black/90 px-2 py-2">
                  <div>
                    <p className="line-clamp-1 text-[0.82rem] font-semibold text-white/96">
                      {selectedImage.caption}
                    </p>
                    <p className="text-[0.7rem] text-white/74">{formatDateLabel(selectedImage.takenAt)}</p>
                  </div>
                  <div className="photo-viewer-control-row flex items-center gap-1.25 pb-0.5">
                    <Link
                      href={buildDayLink(selectedImage.takenAt)}
                      className="ui-btn ui-btn-primary photo-viewer-control shrink-0 px-2.5"
                    >
                      이동하기
                    </Link>
                    {previewItemCount > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => moveLightbox(-1)}
                          className="ui-btn photo-viewer-control shrink-0 border-white/26 bg-white/10 px-2.5 text-white hover:bg-white/16"
                          aria-label="이전 사진"
                        >
                          이전
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLightbox(1)}
                          className="ui-btn photo-viewer-control shrink-0 border-white/26 bg-white/10 px-2.5 text-white hover:bg-white/16"
                          aria-label="다음 사진"
                        >
                          다음
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void toggleLightboxFullscreen()}
                      className="ui-btn photo-viewer-control shrink-0 border-white/26 bg-white/10 px-2.5 text-white hover:bg-white/16"
                    >
                      전체화면
                    </button>
                    <button
                      type="button"
                      onClick={closeLightbox}
                      className="ui-btn photo-viewer-control shrink-0 border-white/26 bg-white/10 px-2.5 text-white hover:bg-white/16"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
