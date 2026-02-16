"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type {
  CreatePhotoCommentPayload,
  PhotoCommentRow,
} from "@/lib/gallery/comment-types";
import { MAX_PHOTO_COMMENT_LENGTH } from "@/lib/gallery/comment-validation";
import { getPhotoTags, groupPhotosByTag } from "@/lib/gallery/tags";
import { formatMonthMetaLabel } from "@/lib/gallery/time";
import type {
  HighlightResponse,
  MonthBucketState,
  PhotoItem,
  PhotoMonthPageResponse,
  PhotoSummaryResponse,
  YearMonthStat,
} from "@/lib/gallery/types";
import { lockPageScroll, unlockPageScroll } from "@/lib/ui/scroll-lock";

const PAGE_LIMIT = 24;
const INITIAL_PRELOAD_MONTHS = 2;

type GallerySectionProps = {
  initialSummary: PhotoSummaryResponse;
  initialHighlights: HighlightResponse;
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
  initialHighlights,
  initialMonthPages,
}: GallerySectionProps) {
  const [summary, setSummary] = useState<PhotoSummaryResponse>(initialSummary);
  const [highlights, setHighlights] = useState<HighlightResponse>(initialHighlights);
  const [monthStateMap, setMonthStateMap] = useState<Record<string, MonthBucketState>>(() =>
    buildInitialMonthStateMap(initialSummary, initialMonthPages),
  );
  const [visibleMonthKeys, setVisibleMonthKeys] = useState<string[]>([]);
  const [activeMonthKey, setActiveMonthKey] = useState<string | null>(
    initialSummary.months[0]?.key ?? null,
  );
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [viewMode, setViewMode] = useState<"timeline" | "tags">("timeline");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [commentsByPhotoId, setCommentsByPhotoId] = useState<Record<string, PhotoCommentRow[]>>(
    {},
  );
  const [commentNickname, setCommentNickname] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [commentStatus, setCommentStatus] = useState<CommentAsyncStatus>("idle");
  const [commentError, setCommentError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const monthStateMapRef = useRef<Record<string, MonthBucketState>>(monthStateMap);
  const monthSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const monthSentinelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const inFlightMonthRef = useRef(new Set<string>());

  useEffect(() => {
    monthStateMapRef.current = monthStateMap;
  }, [monthStateMap]);

  useEffect(() => {
    setSummary(initialSummary);
    setHighlights(initialHighlights);
    setMonthStateMap(buildInitialMonthStateMap(initialSummary, initialMonthPages));
    setVisibleMonthKeys([]);
    setActiveMonthKey(initialSummary.months[0]?.key ?? null);
  }, [initialSummary, initialHighlights, initialMonthPages]);

  const monthSummaryMap = useMemo(
    () => new Map(summary.months.map((month) => [month.key, month])),
    [summary.months],
  );
  const monthIndexMap = useMemo(
    () => new Map(summary.months.map((month, index) => [month.key, index])),
    [summary.months],
  );

  const loadedTimelineItems = useMemo(() => {
    return dedupeById(
      summary.months.flatMap((month) => monthStateMap[month.key]?.items ?? []),
    ).sort(sortByTakenAtDesc);
  }, [summary.months, monthStateMap]);

  const effectiveHighlights = useMemo(() => {
    const fallbackItems = loadedTimelineItems;
    const featured = highlights.featured.length > 0 ? highlights.featured : fallbackItems.slice(0, 2);
    const highlightItems =
      highlights.highlights.length > 0 ? highlights.highlights : fallbackItems.slice(2, 8);

    return {
      featured,
      highlights: highlightItems,
    };
  }, [highlights, loadedTimelineItems]);
  const tagAlbums = useMemo(() => groupPhotosByTag(loadedTimelineItems), [loadedTimelineItems]);
  const activeTagItems = useMemo(() => {
    if (!activeTag) {
      return [];
    }

    return loadedTimelineItems.filter((item) => getPhotoTags(item).includes(activeTag));
  }, [activeTag, loadedTimelineItems]);

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
      { rootMargin: "260px 0px", threshold: 0.01 },
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
      { rootMargin: "-24% 0px -58% 0px", threshold: [0, 0.2, 0.5] },
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

  const openLightbox = (
    targetItems: PhotoItem[],
    index: number,
    triggerElement: HTMLButtonElement,
  ) => {
    triggerRef.current = triggerElement;
    setLightbox({ items: targetItems, index });
  };

  const closeLightbox = () => {
    setLightbox(null);
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  };

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
  const portalRoot = typeof document !== "undefined" ? document.body : null;

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

  const selectedMonthMeta = (month: YearMonthStat): string => {
    const monthState = monthStateMap[month.key] ?? makeEmptyMonthState();

    if (!monthState.isHydrated || monthState.items.length === 0) {
      return formatMonthMetaLabel(month.year, month.month, month.count, month.latestUpdatedAt);
    }

    const latestUpdatedAt = monthState.items.reduce((latest, item) => {
      if (+new Date(item.updatedAt) > +new Date(latest)) {
        return item.updatedAt;
      }

      return latest;
    }, monthState.items[0].updatedAt);

    return formatMonthMetaLabel(
      month.year,
      month.month,
      monthState.items.length,
      latestUpdatedAt,
    );
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

  const lightboxOverlay = selectedImage ? (
    <div
      className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-black/88 p-3 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="갤러리 이미지 크게 보기"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeLightbox();
        }
      }}
    >
      <div className="enter-fade-up w-full max-w-3xl overflow-hidden rounded-[1.2rem] border border-white/10 bg-black">
        <div>
          <Image
            src={selectedImage.src}
            alt={selectedImage.alt}
            width={1100}
            height={1300}
            sizes="(max-width: 768px) 92vw, 760px"
            className="max-h-[80vh] w-full object-contain"
            priority
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/90 px-3 py-2 text-white">
          <div>
            <p className="line-clamp-1 text-sm font-semibold text-white/95">{selectedImage.caption}</p>
            <p className="text-[0.72rem] text-white/70">{formatDateLabel(selectedImage.takenAt)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {lightbox && lightbox.items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setLightbox((current) => {
                      if (!current) {
                        return current;
                      }

                      return {
                        ...current,
                        index: (current.index - 1 + current.items.length) % current.items.length,
                      };
                    });
                  }}
                  className="min-h-11 min-w-11 rounded-full bg-white/15 px-3 text-lg font-semibold text-white"
                  aria-label="이전 사진"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLightbox((current) => {
                      if (!current) {
                        return current;
                      }

                      return {
                        ...current,
                        index: (current.index + 1) % current.items.length,
                      };
                    });
                  }}
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
        <div className="border-t border-white/10 bg-black/95 px-3 py-3 text-white">
          <form
            className="rounded-[0.95rem] border border-white/14 bg-white/[0.04] p-2.5"
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
              className="min-h-[4.2rem] w-full resize-none rounded-[0.82rem] border border-white/14 bg-white/[0.08] px-3 py-2.5 text-[0.84rem] leading-[1.5] text-white placeholder:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              maxLength={MAX_PHOTO_COMMENT_LENGTH}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label htmlFor="photo-comment-nickname" className="sr-only">
                닉네임
              </label>
              <input
                id="photo-comment-nickname"
                type="text"
                value={commentNickname}
                onChange={(event) => setCommentNickname(event.target.value)}
                placeholder="닉네임(선택)"
                className="min-h-10 w-[8.5rem] rounded-full border border-white/14 bg-white/[0.08] px-3 text-[0.76rem] text-white placeholder:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                maxLength={24}
              />
              <span className="text-[0.68rem] text-white/70">{remainingCommentChars}자 남음</span>
              <button
                type="submit"
                disabled={commentStatus === "posting"}
                className="ml-auto min-h-10 rounded-full bg-white/18 px-3.5 text-[0.78rem] font-semibold text-white transition-colors hover:bg-white/24 disabled:opacity-60"
              >
                {commentStatus === "posting" ? "남기는 중…" : "남기기"}
              </button>
            </div>
          </form>

          <div className="mt-2 flex items-center justify-between text-[0.68rem] text-white/70">
            <span>{selectedPhotoComments.length}개 댓글</span>
            <span>최신순</span>
          </div>

          {commentError ? (
            <p className="mt-1 rounded-[0.72rem] border border-rose-200/60 bg-rose-500/10 px-2.5 py-1.5 text-[0.72rem] text-rose-100">
              {commentError}
            </p>
          ) : null}

          <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
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
                  <strong className="text-[0.74rem] font-semibold text-white/92">{comment.nickname}</strong>
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
      </div>
    </div>
  ) : null;

  return (
    <>
      <section
        id="gallery"
        className="ui-surface scroll-mt-24 w-full rounded-[var(--radius-lg)] p-4 sm:p-5"
      >
        <div className="mb-5">
          <h2 className="ui-title">요즘 루다는</h2>
          <p className="mt-1.5 text-[0.9rem] leading-[1.56] text-[color:var(--color-muted)]">
            칩 선택 없이 스크롤로 월별 앨범을 이어서 확인해요.
          </p>
        </div>

        <section className="mb-5 space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`ui-btn px-3.5 ${viewMode === "timeline" ? "ui-btn-primary" : "ui-btn-secondary"}`}
            >
              날짜별
            </button>
            <button
              type="button"
              onClick={() => setViewMode("tags")}
              className={`ui-btn px-3.5 ${viewMode === "tags" ? "ui-btn-primary" : "ui-btn-secondary"}`}
            >
              이벤트별
            </button>
          </div>

          {viewMode === "tags" ? (
            activeTag ? (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[0.86rem] font-semibold text-[color:var(--color-ink)]">#{activeTag}</p>
                  <button
                    type="button"
                    onClick={() => setActiveTag(null)}
                    className="ui-btn ui-btn-secondary px-3"
                  >
                    태그 목록
                  </button>
                </div>
                {activeTagItems.length === 0 ? (
                  <p className="rounded-[0.9rem] border border-[color:var(--color-line)] bg-white/84 px-3 py-2 text-[0.82rem] text-[color:var(--color-muted)]">
                    아직 이 태그의 사진이 로드되지 않았어요. 날짜별에서 스크롤하면 자동으로 추가됩니다.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
                    {activeTagItems.map((item, index) => (
                      <button
                        key={`tag-item-${item.id}`}
                        type="button"
                        onClick={(event) => openLightbox(activeTagItems, index, event.currentTarget)}
                        className="group relative overflow-hidden rounded-[0.82rem] bg-[color:var(--color-brand-soft)] text-left"
                        aria-label={`${item.caption} 확대 보기`}
                      >
                        <Image
                          src={item.thumbSrc ?? item.src}
                          alt={item.alt}
                          width={420}
                          height={420}
                          sizes="(max-width: 767px) 50vw, 280px"
                          className="motion-safe-scale aspect-square w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : tagAlbums.length === 0 ? (
              <p className="rounded-[0.9rem] border border-[color:var(--color-line)] bg-white/84 px-3 py-2 text-[0.82rem] text-[color:var(--color-muted)]">
                태그 앨범을 보려면 먼저 날짜별 섹션을 스크롤해 사진을 불러와 주세요.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
                {tagAlbums.map((album) => (
                  <button
                    key={`album-${album.tag}`}
                    type="button"
                    onClick={() => setActiveTag(album.tag)}
                    className="overflow-hidden rounded-[0.9rem] border border-[color:var(--color-line)] bg-white/88 text-left"
                  >
                    <div className="relative bg-[color:var(--color-brand-soft)]">
                      <Image
                        src={album.cover.thumbSrc ?? album.cover.src}
                        alt={`${album.tag} 태그 대표 사진`}
                        width={520}
                        height={420}
                        sizes="(max-width: 767px) 50vw, 280px"
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="text-[0.82rem] font-semibold text-[color:var(--color-ink)]">#{album.tag}</p>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : null}
        </section>

        {viewMode === "timeline" ? (
          <section id="gallery-highlights" className="mb-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[1rem] font-semibold text-[color:var(--color-ink)]">요즘 루다 포인트</h3>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {effectiveHighlights.featured.map((image, index) => (
                <button
                  key={`featured-${image.id}`}
                  data-highlight-card
                  type="button"
                  onClick={(event) => openLightbox(effectiveHighlights.featured, index, event.currentTarget)}
                  className="group relative overflow-hidden rounded-[0.95rem] bg-[color:var(--color-brand-soft)] text-left"
                  aria-label={`${image.caption} 확대 보기`}
                >
                  <Image
                    src={image.thumbSrc ?? image.src}
                    alt={image.alt}
                    width={960}
                    height={760}
                    sizes="(max-width: 767px) 50vw, 420px"
                    className="motion-safe-scale aspect-[4/3] w-full object-cover"
                    priority
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/52 to-transparent px-2.5 pb-2.5 pt-9">
                    <p className="text-[0.76rem] font-semibold text-white/95">{image.caption}</p>
                    <p className="text-[0.66rem] text-white/78">{formatDateLabel(image.takenAt)}</p>
                  </div>
                </button>
              ))}
            </div>

            {effectiveHighlights.highlights.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {effectiveHighlights.highlights.map((image, index) => (
                  <button
                    key={`highlight-${image.id}`}
                    data-highlight-card
                    type="button"
                    onClick={(event) => openLightbox(effectiveHighlights.highlights, index, event.currentTarget)}
                    className="group relative overflow-hidden rounded-[0.9rem] bg-[color:var(--color-brand-soft)] text-left"
                    aria-label={`${image.caption} 확대 보기`}
                  >
                    <Image
                      src={image.thumbSrc ?? image.src}
                      alt={image.alt}
                      width={480}
                      height={480}
                      sizes="(max-width: 767px) 33vw, 220px"
                      className="motion-safe-scale aspect-square w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {viewMode === "timeline" ? (
          <section id="monthly-archive" className="space-y-2.5">
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white/86 px-3.5 py-3">
              <p className="text-[0.76rem] font-semibold text-[color:var(--color-brand-strong)]">전체 앨범</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[1rem] font-semibold text-[color:var(--color-ink)]">
                  총 {summary.totalCount}장
                </h3>
                {activeMonthKey ? (
                  <p className="text-[0.78rem] font-medium text-[color:var(--color-muted)]">
                    현재 {monthSummaryMap.get(activeMonthKey)?.label}
                  </p>
                ) : null}
              </div>
              <p className="mt-1 text-[0.76rem] text-[color:var(--color-muted)]">
                스크롤할 때 월 단위로 자동 로딩돼요.
              </p>
            </div>

            {summary.months.map((month) => {
              const monthState = monthStateMap[month.key] ?? makeEmptyMonthState();
              const showSkeleton =
                monthState.isLoading && (!monthState.isHydrated || monthState.items.length === 0);
              const showEmpty =
                monthState.isHydrated &&
                !monthState.isLoading &&
                monthState.items.length === 0 &&
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
                  className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white/86"
                >
                  <header className="px-3.5 py-3">
                    <p className="text-[0.96rem] font-semibold text-[color:var(--color-ink)]">
                      {month.year}년 {month.month}월
                    </p>
                    <p className="mt-1 text-[0.72rem] font-medium text-[color:var(--color-muted)]">
                      총 {month.count}장 · {selectedMonthMeta(month)}
                    </p>
                  </header>

                  {monthState.items.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5 p-2 pt-0 md:grid-cols-3">
                      {monthState.items.map((image, index) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={(event) => openLightbox(monthState.items, index, event.currentTarget)}
                          className="group relative overflow-hidden rounded-[0.88rem] bg-[color:var(--color-brand-soft)] text-left"
                          aria-label={`${image.caption} 확대 보기`}
                        >
                          <Image
                            src={image.thumbSrc ?? image.src}
                            alt={image.alt}
                            width={420}
                            height={560}
                            sizes="(max-width: 767px) 50vw, (max-width: 1024px) 33vw, 280px"
                            className="motion-safe-scale aspect-square w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {showSkeleton ? (
                    <div className="grid grid-cols-2 gap-1.5 p-2 pt-0 md:grid-cols-3">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={`${month.key}-skeleton-${index}`}
                          className="aspect-square rounded-[0.88rem] bg-[color:var(--color-brand-soft)]/70"
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  ) : null}

                  {showInitialHint ? (
                    <p className="px-3.5 pb-3 text-[0.82rem] text-[color:var(--color-muted)]">
                      이 영역에 진입하면 사진을 불러옵니다.
                    </p>
                  ) : null}

                  {showEmpty ? (
                    <p className="px-3.5 pb-3 text-[0.82rem] text-[color:var(--color-muted)]">
                      이 달에는 사진이 아직 없어요.
                    </p>
                  ) : null}

                  {monthState.hasError ? (
                    <div
                      className="mx-3.5 mb-3 flex flex-wrap items-center gap-2 rounded-[0.9rem] border border-rose-200/90 bg-rose-50 px-3 py-2 text-[0.8rem] text-rose-700"
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
                    <p className="px-3.5 pb-2 text-[0.72rem] text-[color:var(--color-muted)]">
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
          </section>
        ) : null}
      </section>

      {portalRoot && lightboxOverlay ? createPortal(lightboxOverlay, portalRoot) : null}
    </>
  );
}
