"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type {
  CreatePhotoCommentPayload,
  PhotoCommentRow,
} from "@/lib/gallery/comment-types";
import { MAX_PHOTO_COMMENT_LENGTH } from "@/lib/gallery/comment-validation";
import type {
  MonthBucketState,
  PhotoItem,
  PhotoMonthPageResponse,
  PhotoSummaryResponse,
} from "@/lib/gallery/types";
import { getPhotoTags } from "@/lib/gallery/tags";
import { usePhotoGestures } from "@/lib/ui/photo-gestures";
import { usePhotoViewerMode } from "@/lib/ui/photo-viewer-mode";
import { lockPageScroll, unlockPageScroll } from "@/lib/ui/scroll-lock";

const PAGE_LIMIT = 18;
const INITIAL_PRELOAD_MONTHS = 2;

type GallerySectionProps = {
  initialSummary: PhotoSummaryResponse;
  initialMonthPages: Record<string, PhotoMonthPageResponse>;
};

type LightboxState = {
  items: PhotoItem[];
  index: number;
};

type PhotoCommentsResponse = {
  items: PhotoCommentRow[];
};

type PhotoCommentErrorResponse = {
  error?: string;
};

type CommentAsyncStatus = "idle" | "loading" | "posting";

const makeEmptyMonthState = (): MonthBucketState => ({
  items: [],
  nextCursor: null,
  isLoading: false,
  isHydrated: false,
  hasError: null,
});

const dedupeById = (items: PhotoItem[]) => {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
};

const sortByTakenAtDesc = (left: PhotoItem, right: PhotoItem) => {
  return +new Date(right.takenAt) - +new Date(left.takenAt);
};

const formatDateLabel = (takenAt: string) => {
  const date = new Date(takenAt);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

const buildInitialMonthStateMap = (
  summary: PhotoSummaryResponse,
  initialMonthPages: Record<string, PhotoMonthPageResponse>,
): Record<string, MonthBucketState> => {
  return Object.fromEntries(
    summary.months.map((month) => {
      const preloaded = initialMonthPages[month.key];

      if (!preloaded) {
        return [month.key, makeEmptyMonthState()];
      }

      return [
        month.key,
        {
          items: preloaded.items,
          nextCursor: preloaded.nextCursor,
          isHydrated: true,
          isLoading: false,
          hasError: null,
        },
      ];
    }),
  );
};

export function GallerySection({
  initialSummary,
  initialMonthPages,
}: GallerySectionProps) {
  const [summary, setSummary] = useState<PhotoSummaryResponse>(initialSummary);
  const [monthStateMap, setMonthStateMap] = useState<Record<string, MonthBucketState>>(() =>
    buildInitialMonthStateMap(initialSummary, initialMonthPages),
  );
  const [visibleMonthKeys, setVisibleMonthKeys] = useState<string[]>([]);
  const [activeMonthKey, setActiveMonthKey] = useState<string | null>(
    initialSummary.months[0]?.key ?? null,
  );
  const [activeEventName, setActiveEventName] = useState("전체");
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [lightboxDirection, setLightboxDirection] = useState<-1 | 0 | 1>(0);
  const [commentsByPhotoId, setCommentsByPhotoId] = useState<Record<string, PhotoCommentRow[]>>(
    {},
  );
  const [commentNickname, setCommentNickname] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [commentStatus, setCommentStatus] = useState<CommentAsyncStatus>("idle");
  const [commentError, setCommentError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const lightboxImmersiveRef = useRef<HTMLDivElement | null>(null);
  const monthStateMapRef = useRef<Record<string, MonthBucketState>>(monthStateMap);
  const monthSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const monthSentinelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const inFlightMonthRef = useRef(new Set<string>());
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    monthStateMapRef.current = monthStateMap;
  }, [monthStateMap]);

  useEffect(() => {
    setSummary(initialSummary);
    setMonthStateMap(buildInitialMonthStateMap(initialSummary, initialMonthPages));
    setVisibleMonthKeys([]);
    setActiveMonthKey(initialSummary.months[0]?.key ?? null);
    setActiveEventName("전체");
  }, [initialSummary, initialMonthPages]);

  const monthSummaryMap = useMemo(
    () => new Map(summary.months.map((month) => [month.key, month])),
    [summary.months],
  );
  const monthIndexMap = useMemo(
    () => new Map(summary.months.map((month, index) => [month.key, index])),
    [summary.months],
  );
  const eventStats = useMemo(() => {
    const counts = new Map<string, number>();
    const uniqueItems = dedupeById(
      Object.values(monthStateMap).flatMap((state) => state.items),
    );

    for (const item of uniqueItems) {
      for (const eventName of getPhotoTags(item)) {
        counts.set(eventName, (counts.get(eventName) ?? 0) + 1);
      }
    }

    return [...counts.entries()].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], "ko");
    });
  }, [monthStateMap]);

  useEffect(() => {
    if (activeEventName === "전체") {
      return;
    }

    const available = new Set(eventStats.map(([eventName]) => eventName));
    if (!available.has(activeEventName)) {
      setActiveEventName("전체");
    }
  }, [activeEventName, eventStats]);

  const selectedImage = lightbox ? lightbox.items[lightbox.index] : null;
  const selectedPhotoComments = selectedImage ? commentsByPhotoId[selectedImage.id] ?? [] : [];
  const remainingCommentChars = MAX_PHOTO_COMMENT_LENGTH - commentMessage.length;
  const commentDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  const {
    isImmersive: isLightboxImmersive,
    isOverlayVisible,
    toggleImmersive: toggleLightboxFullscreen,
    exitImmersive: exitLightboxImmersive,
    showOverlayTemporarily,
  } = usePhotoViewerMode({
    frameRef: lightboxImmersiveRef,
    isOpen: Boolean(lightbox),
    autoHideMs: 2200,
  });

  const closeLightbox = useCallback(() => {
    const restoreFocus = () => {
      setLightboxDirection(0);
      setLightbox(null);
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    };

    void exitLightboxImmersive().finally(restoreFocus);
  }, [exitLightboxImmersive]);

  const moveLightbox = useCallback((step: number) => {
    setLightboxDirection(step > 0 ? 1 : -1);
    setLightbox((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        index: (current.index + step + current.items.length) % current.items.length,
      };
    });
  }, []);

  const { isZoomed: isLightboxZoomed, transformStyle: lightboxTransformStyle, bind: lightboxGestureBind, resetTransform: resetLightboxTransform } =
    usePhotoGestures({
      enabled: Boolean(selectedImage && isLightboxImmersive),
      onNavigatePrev: lightbox && lightbox.items.length > 1 ? () => moveLightbox(-1) : undefined,
      onNavigateNext: lightbox && lightbox.items.length > 1 ? () => moveLightbox(1) : undefined,
    });

  const loadMonthPage = useCallback(
    async (monthKey: string) => {
      const month = monthSummaryMap.get(monthKey);

      if (!month) {
        return;
      }

      if (inFlightMonthRef.current.has(monthKey)) {
        return;
      }

      const currentState = monthStateMapRef.current[monthKey] ?? makeEmptyMonthState();
      const cursor = currentState.isHydrated ? currentState.nextCursor : null;

      if (currentState.isHydrated && !cursor) {
        return;
      }

      inFlightMonthRef.current.add(monthKey);
      setMonthStateMap((current) => {
        const previous = current[monthKey] ?? makeEmptyMonthState();

        return {
          ...current,
          [monthKey]: {
            ...previous,
            isLoading: true,
            hasError: null,
          },
        };
      });

      try {
        const params = new URLSearchParams({
          year: `${month.year}`,
          month: `${month.month}`,
          limit: `${PAGE_LIMIT}`,
        });

        if (cursor) {
          params.set("cursor", cursor);
        }

        const response = await fetch(`/api/photos/month?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        const body = (await response.json()) as
          | PhotoMonthPageResponse
          | { error?: string };

        if (!response.ok || !(body as PhotoMonthPageResponse).items) {
          throw new Error((body as { error?: string }).error || "월별 사진을 불러오지 못했어요.");
        }

        const page = body as PhotoMonthPageResponse;

        setMonthStateMap((current) => {
          const previous = current[monthKey] ?? makeEmptyMonthState();
          const baseItems = cursor ? previous.items : [];
          const items = dedupeById([...baseItems, ...page.items]).sort(sortByTakenAtDesc);

          return {
            ...current,
            [monthKey]: {
              items,
              nextCursor: page.nextCursor,
              isHydrated: true,
              isLoading: false,
              hasError: null,
            },
          };
        });
      } catch (error) {
        setMonthStateMap((current) => {
          const previous = current[monthKey] ?? makeEmptyMonthState();

          return {
            ...current,
            [monthKey]: {
              ...previous,
              isLoading: false,
              hasError:
                error instanceof Error
                  ? error.message
                  : "월별 사진을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
            },
          };
        });
      } finally {
        inFlightMonthRef.current.delete(monthKey);
      }
    },
    [monthSummaryMap],
  );

  useEffect(() => {
    const initialMonths = summary.months
      .slice(0, INITIAL_PRELOAD_MONTHS)
      .map((month) => month.key);

    for (const monthKey of initialMonths) {
      void loadMonthPage(monthKey);
    }
  }, [summary.months, loadMonthPage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const monthKey = (entry.target as HTMLElement).dataset.monthKey;

          if (!monthKey) {
            continue;
          }

          void loadMonthPage(monthKey);

          const currentIndex = monthIndexMap.get(monthKey);
          const nextMonthKey =
            typeof currentIndex === "number"
              ? summary.months[currentIndex + 1]?.key
              : undefined;

          if (nextMonthKey) {
            void loadMonthPage(nextMonthKey);
          }
        }
      },
      { rootMargin: "280px 0px", threshold: 0.01 },
    );

    for (const month of summary.months) {
      const target = monthSentinelRefs.current[month.key];

      if (target) {
        observer.observe(target);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [summary.months, monthIndexMap, loadMonthPage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleMonthKeys((current) => {
          const next = new Set(current);
          let changed = false;

          for (const entry of entries) {
            const monthKey = (entry.target as HTMLElement).dataset.monthKey;

            if (!monthKey) {
              continue;
            }

            if (entry.isIntersecting) {
              if (!next.has(monthKey)) {
                next.add(monthKey);
                changed = true;
              }
            } else if (next.delete(monthKey)) {
              changed = true;
            }
          }

          return changed ? [...next] : current;
        });
      },
      { rootMargin: "-18% 0px -64% 0px", threshold: [0, 0.2, 0.5] },
    );

    for (const month of summary.months) {
      const target = monthSectionRefs.current[month.key];

      if (target) {
        observer.observe(target);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [summary.months]);

  useEffect(() => {
    if (visibleMonthKeys.length === 0) {
      if (summary.months.length > 0) {
        setActiveMonthKey(summary.months[0].key);
      }
      return;
    }

    const sorted = [...visibleMonthKeys].sort((left, right) => {
      return (monthIndexMap.get(left) ?? 0) - (monthIndexMap.get(right) ?? 0);
    });
    const nextActive = sorted[0] ?? null;

    if (nextActive !== activeMonthKey) {
      setActiveMonthKey(nextActive);
    }
  }, [activeMonthKey, monthIndexMap, summary.months, visibleMonthKeys]);

  useEffect(() => {
    for (const monthKey of visibleMonthKeys) {
      void loadMonthPage(monthKey);

      const currentIndex = monthIndexMap.get(monthKey);
      const nextMonthKey =
        typeof currentIndex === "number"
          ? summary.months[currentIndex + 1]?.key
          : undefined;

      if (nextMonthKey) {
        void loadMonthPage(nextMonthKey);
      }
    }
  }, [visibleMonthKeys, summary.months, monthIndexMap, loadMonthPage]);

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
    if (!selectedImage) {
      return;
    }

    resetLightboxTransform();
  }, [isLightboxImmersive, resetLightboxTransform, selectedImage]);

  useEffect(() => {
    if (!lightbox || !selectedImage || lightbox.items.length < 2 || typeof window === "undefined") {
      return;
    }

    const nextItem = lightbox.items[(lightbox.index + 1) % lightbox.items.length];
    const prevItem = lightbox.items[(lightbox.index - 1 + lightbox.items.length) % lightbox.items.length];
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
  }, [lightbox, selectedImage]);

  useEffect(() => {
    if (!lightbox) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
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

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    closeLightbox,
    exitLightboxImmersive,
    isLightboxImmersive,
    lightbox,
    moveLightbox,
    toggleLightboxFullscreen,
  ]);

  const loadPhotoComments = useCallback(async (photoId: string) => {
    setCommentStatus("loading");
    setCommentError(null);

    try {
      const response = await fetch(`/api/photos/${encodeURIComponent(photoId)}/comments`, {
        method: "GET",
        cache: "no-store",
      });
      const body = (await response.json()) as PhotoCommentsResponse | PhotoCommentErrorResponse;

      if (!response.ok || !(body as PhotoCommentsResponse).items) {
        throw new Error((body as PhotoCommentErrorResponse).error || "댓글을 불러오지 못했어요.");
      }

      setCommentsByPhotoId((current) => ({
        ...current,
        [photoId]: (body as PhotoCommentsResponse).items,
      }));
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "댓글을 불러오지 못했어요.");
    } finally {
      setCommentStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (!selectedImage) {
      return;
    }

    setCommentMessage("");
    setCommentError(null);

    if (selectedImage.id in commentsByPhotoId) {
      return;
    }

    void loadPhotoComments(selectedImage.id);
  }, [selectedImage, commentsByPhotoId, loadPhotoComments]);

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedImage || commentStatus === "posting") {
      return;
    }

    if (!commentMessage.trim()) {
      setCommentError("댓글 내용을 입력해 주세요.");
      return;
    }

    const payload: CreatePhotoCommentPayload = {
      nickname: commentNickname,
      message: commentMessage,
    };

    setCommentStatus("posting");
    setCommentError(null);

    try {
      const response = await fetch(`/api/photos/${encodeURIComponent(selectedImage.id)}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as PhotoCommentRow | PhotoCommentErrorResponse;

      if (!response.ok || !(body as PhotoCommentRow).id) {
        throw new Error((body as PhotoCommentErrorResponse).error || "댓글 등록에 실패했어요.");
      }

      const created = body as PhotoCommentRow;

      setCommentsByPhotoId((current) => ({
        ...current,
        [selectedImage.id]: [created, ...(current[selectedImage.id] ?? [])],
      }));
      setCommentMessage("");
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "댓글 등록에 실패했어요.");
    } finally {
      setCommentStatus("idle");
    }
  };

  const openLightbox = (
    targetItems: PhotoItem[],
    index: number,
    triggerElement: HTMLButtonElement,
  ) => {
    triggerRef.current = triggerElement;
    setLightboxDirection(0);
    setLightbox({ items: targetItems, index });
  };

  if (summary.totalCount === 0) {
    return (
      <section
        id="gallery"
        className="ui-surface scroll-mt-24 w-full rounded-[var(--radius-lg)] p-4 sm:p-5"
      >
        <h2 className="ui-title">아직 공개된 사진이 없어요</h2>
        <p className="mt-2 text-[0.9rem] text-[color:var(--color-muted)]">
          첫 사진이 올라오면 여기에 바로 보여드릴게요.
        </p>
        <p className="mt-1 text-[0.82rem] text-[color:var(--color-muted)]">
          관리 페이지에서 업로드하면 앨범에 자동 반영됩니다.
        </p>
        <Link href="/admin" className="ui-btn ui-btn-primary mt-4 px-4">
          첫 사진 올리러 가기
        </Link>
      </section>
    );
  }

  const activeMonth =
    (activeMonthKey ? monthSummaryMap.get(activeMonthKey) : null) ??
    summary.months[0] ??
    null;
  const portalRoot = typeof document !== "undefined" ? document.body : null;

  return (
    <>
      <section id="gallery" className="scroll-mt-24 w-full">
        <header className="mb-3">
          <h2 className="ui-title">요즘 루다는</h2>
          <p className="mt-1 text-[0.82rem] text-[color:var(--color-muted)]">
            총 {summary.totalCount}장의 사진을 월별로 이어서 보고 있어요.
          </p>
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveEventName("전체")}
              className={`min-h-9 whitespace-nowrap rounded-full border px-3 text-[0.72rem] font-semibold ${
                activeEventName === "전체"
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-strong)]"
                  : "border-[color:var(--color-line)] bg-white text-[color:var(--color-muted)]"
              }`}
            >
              전체
            </button>
            {eventStats.map(([eventName, count]) => (
              <button
                key={eventName}
                type="button"
                onClick={() => setActiveEventName(eventName)}
                className={`min-h-9 whitespace-nowrap rounded-full border px-3 text-[0.72rem] font-semibold ${
                  activeEventName === eventName
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-strong)]"
                    : "border-[color:var(--color-line)] bg-white text-[color:var(--color-muted)]"
                }`}
              >
                {eventName} · {count}
              </button>
            ))}
          </div>
        </header>

        {activeMonth ? (
          <div className="sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-20 mb-3 pointer-events-none">
            <span className="inline-flex items-center rounded-full border border-[color:var(--color-line)] bg-white/90 px-3 py-1 text-[0.72rem] font-semibold text-[color:var(--color-ink)] shadow-sm backdrop-blur-sm">
              {activeMonth.year}년 {activeMonth.month}월 ·{" "}
              {activeEventName === "전체" ? "총" : `${activeEventName} 이벤트`}{" "}
              {activeMonth.count}장
            </span>
          </div>
        ) : null}

        <div className="space-y-4">
          {summary.months.map((month) => {
            const monthState = monthStateMap[month.key] ?? makeEmptyMonthState();
            const filteredItems =
              activeEventName === "전체"
                ? monthState.items
                : monthState.items.filter((image) => getPhotoTags(image).includes(activeEventName));
            const showSkeleton =
              monthState.isLoading && (!monthState.isHydrated || monthState.items.length === 0);
            const showEmpty =
              monthState.isHydrated &&
              !monthState.isLoading &&
              filteredItems.length === 0 &&
              !monthState.hasError;
            const showInitialHint =
              !monthState.isHydrated && !monthState.isLoading && !monthState.hasError;

            return (
              <article
                key={month.key}
                id={`archive-${month.key}`}
                ref={(node) => {
                  monthSectionRefs.current[month.key] = node;
                }}
                data-month-key={month.key}
                className="relative"
              >
                <header className="sticky top-[calc(env(safe-area-inset-top)+2.8rem)] z-10 mb-2">
                  <div className="inline-flex flex-col rounded-full border border-[color:var(--color-line)] bg-white/94 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                    <p className="text-[0.86rem] font-semibold leading-none text-[color:var(--color-ink)]">
                      {month.year}년 {month.month}월
                    </p>
                    <p className="mt-1 text-[0.7rem] leading-none text-[color:var(--color-muted)]">
                      총 {month.count}장
                    </p>
                  </div>
                </header>

                {filteredItems.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
                    {filteredItems.map((image, index) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={(event) => openLightbox(filteredItems, index, event.currentTarget)}
                        className="group relative overflow-hidden rounded-[0.72rem] bg-[color:var(--color-brand-soft)] text-left"
                        aria-label={`${image.caption} 확대 보기`}
                      >
                        <Image
                          src={image.thumbSrc ?? image.src}
                          alt={image.alt}
                          width={420}
                          height={560}
                          quality={60}
                          sizes="(max-width: 639px) 33vw, (max-width: 1023px) 25vw, 18vw"
                          className="motion-safe-scale aspect-square w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}

                {showSkeleton ? (
                  <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
                    {Array.from({ length: 10 }).map((_, index) => (
                      <div
                        key={`${month.key}-skeleton-${index}`}
                        className="aspect-square rounded-[0.72rem] bg-[color:var(--color-brand-soft)]/80"
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                ) : null}

                {showInitialHint ? (
                  <p className="mt-2 text-[0.78rem] text-[color:var(--color-muted)]">
                    이 달 영역에 진입하면 사진을 자동으로 불러와요.
                  </p>
                ) : null}

                {showEmpty ? (
                  <p className="mt-2 text-[0.78rem] text-[color:var(--color-muted)]">
                    {activeEventName === "전체"
                      ? "이 달에는 사진이 아직 없어요."
                      : `${activeEventName} 이벤트 사진이 이 달에는 없어요.`}
                  </p>
                ) : null}

                {monthState.hasError ? (
                  <div
                    className="mt-2 flex flex-wrap items-center gap-2 rounded-[0.9rem] border border-rose-200/90 bg-rose-50 px-3 py-2 text-[0.8rem] text-rose-700"
                    role="alert"
                  >
                    <span>{monthState.hasError}</span>
                    <button
                      type="button"
                      onClick={() => void loadMonthPage(month.key)}
                      className="ui-btn ui-btn-secondary px-3"
                    >
                      다시 시도
                    </button>
                  </div>
                ) : null}

                {monthState.isHydrated && monthState.nextCursor ? (
                  <p className="mt-2 text-[0.72rem] text-[color:var(--color-muted)]">
                    계속 스크롤하면 이 달의 사진을 더 불러와요.
                  </p>
                ) : null}

                <div
                  ref={(node) => {
                    monthSentinelRefs.current[month.key] = node;
                  }}
                  data-month-key={month.key}
                  className="h-1 w-full"
                  aria-hidden="true"
                />
              </article>
            );
          })}
        </div>
      </section>

      {portalRoot
        ? createPortal(
            <AnimatePresence>
              {selectedImage ? (
                <motion.div
                  key={selectedImage.id}
                  className={`fixed inset-0 z-[var(--z-overlay)] flex bg-black/90 ${
                    isLightboxImmersive
                      ? "items-stretch justify-center p-0"
                      : "items-center justify-center p-2 sm:p-3 backdrop-blur-[2px]"
                  }`}
                  role="dialog"
                  aria-modal="true"
                  aria-label="갤러리 이미지 크게 보기"
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
                            width={1100}
                            height={1300}
                            sizes={isLightboxImmersive ? "100vw" : "(max-width: 768px) 92vw, 760px"}
                            className={`select-none object-contain ${
                              isLightboxImmersive ? "h-full w-full" : "max-h-[80vh] w-full"
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
                          <div className="absolute inset-x-0 bottom-[max(0.62rem,env(safe-area-inset-bottom))] flex justify-center px-2.5">
                            <div className="photo-viewer-control-row flex max-w-full items-center gap-1.5 rounded-full border border-white/18 bg-black/58 px-2 py-1.5 backdrop-blur-sm">
                              {lightbox && lightbox.items.length > 1 ? (
                                <>
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
                                </>
                              ) : null}
                              {isLightboxZoomed ? (
                                <span className="photo-viewer-control shrink-0 px-2 text-[0.68rem] font-semibold text-white/84">
                                  확대됨
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {!isLightboxImmersive ? (
                      <>
                        <div className="flex items-center justify-between gap-1.5 border-t border-white/10 bg-black/90 px-2 py-1.5 text-white">
                          <div>
                            <p className="line-clamp-1 text-[0.82rem] font-semibold text-white/95">
                              {selectedImage.caption}
                            </p>
                            <p className="text-[0.7rem] text-white/70">
                              {formatDateLabel(selectedImage.takenAt)}
                            </p>
                            <p className="text-[0.66rem] text-white/60">
                              {getPhotoTags(selectedImage).join(", ")}
                            </p>
                          </div>
                          <div className="photo-viewer-control-row flex items-center gap-1.25 pb-0.5">
                            {lightbox && lightbox.items.length > 1 ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => moveLightbox(-1)}
                                  className="photo-viewer-control min-h-10 min-w-10 shrink-0 rounded-full bg-white/15 px-2.5 text-base font-semibold text-white"
                                  aria-label="이전 사진"
                                >
                                  ‹
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveLightbox(1)}
                                  className="photo-viewer-control min-h-10 min-w-10 shrink-0 rounded-full bg-white/15 px-2.5 text-base font-semibold text-white"
                                  aria-label="다음 사진"
                                >
                                  ›
                                </button>
                              </>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void toggleLightboxFullscreen()}
                              className="photo-viewer-control min-h-10 shrink-0 whitespace-nowrap rounded-full bg-white/20 px-2.5 text-[0.7rem] font-semibold text-white"
                            >
                              전체화면
                            </button>
                            <button
                              type="button"
                              onClick={closeLightbox}
                              className="photo-viewer-control min-h-10 shrink-0 whitespace-nowrap rounded-full bg-white/20 px-2.5 text-[0.78rem] font-semibold text-white"
                            >
                              닫기
                            </button>
                          </div>
                        </div>
                        <div className="border-t border-white/10 bg-black/95 px-2 py-2 text-white">
                          <form
                            className="rounded-[0.95rem] border border-white/14 bg-white/[0.04] p-2"
                            onSubmit={handleSubmitComment}
                          >
                            <label htmlFor="photo-comment-message" className="sr-only">
                              댓글 내용
                            </label>
                            <textarea
                              id="photo-comment-message"
                              value={commentMessage}
                              onChange={(event) => {
                                setCommentMessage(event.target.value);
                                if (commentError) {
                                  setCommentError(null);
                                }
                              }}
                              placeholder="댓글을 남겨주세요"
                              className="min-h-[3rem] w-full resize-none rounded-[0.82rem] border border-white/14 bg-white/[0.08] px-2.5 py-1.5 text-[0.8rem] leading-[1.5] text-white placeholder:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                              maxLength={MAX_PHOTO_COMMENT_LENGTH}
                            />
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <label htmlFor="photo-comment-nickname" className="sr-only">
                                닉네임
                              </label>
                              <input
                                id="photo-comment-nickname"
                                type="text"
                                value={commentNickname}
                                onChange={(event) => setCommentNickname(event.target.value)}
                                placeholder="닉네임(선택)"
                                className="min-h-9 w-[7.8rem] rounded-full border border-white/14 bg-white/[0.08] px-2.5 text-[0.72rem] text-white placeholder:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                                maxLength={24}
                              />
                              <span className="text-[0.66rem] text-white/70">{remainingCommentChars}자 남음</span>
                              <button
                                type="submit"
                                disabled={commentStatus === "posting"}
                                className="photo-viewer-control ml-auto min-h-9 rounded-full bg-white/18 px-3 text-[0.74rem] font-semibold text-white transition-colors hover:bg-white/24 disabled:opacity-60"
                              >
                                {commentStatus === "posting" ? "남기는 중…" : "남기기"}
                              </button>
                            </div>
                          </form>

                          <div className="mt-1.5 flex items-center justify-between text-[0.66rem] text-white/70">
                            <span>{selectedPhotoComments.length}개 댓글</span>
                            <span>최신순</span>
                          </div>

                          {commentError ? (
                            <p className="mt-1 rounded-[0.72rem] border border-rose-200/60 bg-rose-500/10 px-2.5 py-1.5 text-[0.72rem] text-rose-100">
                              {commentError}
                            </p>
                          ) : null}

                          <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto pr-1">
                            {commentStatus === "loading" && selectedPhotoComments.length === 0 ? (
                              <p className="text-[0.74rem] text-white/70">댓글을 불러오는 중…</p>
                            ) : null}
                            {commentStatus !== "loading" && selectedPhotoComments.length === 0 ? (
                              <p className="text-[0.74rem] text-white/70">첫 댓글을 남겨주세요.</p>
                            ) : null}
                            {selectedPhotoComments.map((comment) => (
                              <article
                                key={comment.id}
                                className="rounded-[0.78rem] border border-white/10 bg-white/[0.06] px-2.5 py-2"
                              >
                                <header className="flex items-center justify-between gap-2">
                                  <strong className="text-[0.74rem] font-semibold text-white/92">
                                    {comment.nickname}
                                  </strong>
                                  <time className="text-[0.66rem] text-white/60">
                                    {commentDateFormatter.format(new Date(comment.created_at))}
                                  </time>
                                </header>
                                <p className="mt-1 whitespace-pre-wrap text-[0.78rem] leading-[1.45] text-white/88">
                                  {comment.message}
                                </p>
                              </article>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            portalRoot,
          )
        : null}
    </>
  );
}
