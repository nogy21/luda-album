"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { FixedBottomNav } from "@/components/fixed-bottom-nav";
import { getRandomDateItems } from "@/lib/gallery/featured";
import type { GalleryImage } from "@/lib/gallery/images";
import { lockPageScroll, unlockPageScroll } from "@/lib/ui/scroll-lock";

type AppShellProps = {
  children: ReactNode;
};

const formatDateLabel = (takenAt: string) => {
  const date = new Date(takenAt);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="page-bottom-safe min-h-screen">
      <a
        href="#main-content"
        className="ui-btn ui-btn-secondary absolute left-3 top-3 z-[90] -translate-y-24 px-3 text-sm focus-visible:translate-y-0"
      >
        본문으로 건너뛰기
      </a>
      <main
        id="main-content"
        className="mx-auto w-full max-w-[780px] px-3.5 pt-[max(0.4rem,env(safe-area-inset-top))] sm:px-5 sm:pt-3"
      >
        {children}
      </main>

      <FixedBottomNav maxWidth={780} />
    </div>
  );
}

type CoverCardProps = {
  images?: GalleryImage[];
};

export function CoverCard({ images = [] }: CoverCardProps) {
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.random());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const previewImages = useMemo(
    () => getRandomDateItems(images, 3, () => shuffleSeed),
    [images, shuffleSeed],
  );

  const selectedImage = lightboxIndex !== null ? previewImages[lightboxIndex] ?? null : null;
  const previewDateLabel = useMemo(() => {
    if (!previewImages[0]) {
      return "";
    }

    return formatDateLabel(previewImages[0].takenAt);
  }, [previewImages]);

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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxIndex(null);
        window.requestAnimationFrame(() => {
          triggerRef.current?.focus();
        });
        return;
      }

      if (event.key === "ArrowLeft") {
        setLightboxIndex((current) => {
          if (current === null) {
            return current;
          }

          return (current - 1 + previewImages.length) % previewImages.length;
        });
      }

      if (event.key === "ArrowRight") {
        setLightboxIndex((current) => {
          if (current === null) {
            return current;
          }

          return (current + 1) % previewImages.length;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImages.length, selectedImage]);

  const handleShuffle = () => {
    setShuffleSeed(Math.random());
    setLightboxIndex(null);
  };

  if (previewImages.length === 0) {
    return null;
  }

  return (
    <section className="ui-surface mb-[var(--space-section-sm)] overflow-hidden rounded-[var(--radius-xl)] p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="ui-eyebrow">Album Preview</p>
          <h1 className="mt-1 text-[length:var(--text-hero-title)] font-bold leading-[1.25] tracking-[-0.02em] text-[color:var(--color-ink)]">
            랜덤 데이 미리보기
          </h1>
          <p className="mt-1 text-[0.76rem] font-medium text-[color:var(--color-muted)]">{previewDateLabel}</p>
        </div>

        <button
          type="button"
          onClick={handleShuffle}
          aria-label="랜덤 날짜 사진 다시 고르기"
          className="ui-btn ui-btn-secondary px-3"
        >
          섞기
        </button>
      </div>

      <div className={`grid gap-1.5 ${previewImages.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
        {previewImages.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setLightboxIndex(index);
            }}
            className="group relative overflow-hidden rounded-[0.9rem] bg-[color:var(--color-brand-soft)] text-left"
            aria-label={`${image.caption} 확대 보기`}
          >
            <Image
              src={image.thumbSrc ?? image.src}
              alt={image.alt}
              width={1000}
              height={1000}
              priority={index === 0}
              sizes={previewImages.length === 1 ? "(max-width: 780px) 92vw, 700px" : "(max-width: 640px) 31vw, 220px"}
              className={`motion-safe-scale w-full object-cover ${previewImages.length === 1 ? "aspect-[5/4]" : "aspect-square"}`}
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/58 to-transparent px-2.5 pb-2 pt-8 text-[0.72rem] font-semibold text-white/95">
              {image.caption}
            </span>
          </button>
        ))}
      </div>

      {selectedImage ? (
        <div
          className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-black/88 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="랜덤 데이 사진"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setLightboxIndex(null);
              window.requestAnimationFrame(() => {
                triggerRef.current?.focus();
              });
            }
          }}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-[1.2rem] border border-white/10 bg-black">
            <Image
              src={selectedImage.src}
              alt={selectedImage.alt}
              width={1200}
              height={1300}
              sizes="(max-width: 768px) 92vw, 760px"
              className="max-h-[80vh] w-full object-contain"
              priority
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/90 px-3 py-2.5">
              <div>
                <p className="text-[0.88rem] font-semibold text-white/95">{selectedImage.caption}</p>
                <p className="text-[0.72rem] text-white/72">{formatDateLabel(selectedImage.takenAt)}</p>
              </div>

              <div className="flex items-center gap-1.5">
                {previewImages.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setLightboxIndex((current) => {
                          if (current === null) {
                            return current;
                          }

                          return (current - 1 + previewImages.length) % previewImages.length;
                        });
                      }}
                      className="ui-btn border-white/26 bg-white/10 px-3 text-white hover:bg-white/16"
                      aria-label="이전 사진"
                    >
                      이전
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLightboxIndex((current) => {
                          if (current === null) {
                            return current;
                          }

                          return (current + 1) % previewImages.length;
                        });
                      }}
                      className="ui-btn border-white/26 bg-white/10 px-3 text-white hover:bg-white/16"
                      aria-label="다음 사진"
                    >
                      다음
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setLightboxIndex(null);
                    window.requestAnimationFrame(() => {
                      triggerRef.current?.focus();
                    });
                  }}
                  className="ui-btn border-white/26 bg-white/10 px-4 text-white hover:bg-white/16"
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
