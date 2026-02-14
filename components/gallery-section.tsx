"use client";

import gsap from "gsap";
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
  PhotoItem,
  PhotoListResponse,
  YearMonthStat,
} from "@/lib/gallery/types";
import { lockPageScroll, unlockPageScroll } from "@/lib/ui/scroll-lock";

const PAGE_LIMIT = 36;

type GallerySectionProps = {
  initialData: PhotoListResponse;
  initialHighlights: HighlightResponse;
  initialFilter?: {
    year?: number;
    month?: number;
    day?: number;
  };
};

type LightboxState = {
  items: PhotoItem[];
  index: number;
};

type MonthGroup = {
  key: string;
  label: string;
  year: number;
  month: number;
  latestTakenAt: string;
  latestUpdatedAt: string;
  items: PhotoItem[];
};

type PhotoCommentsResponse = {
  items: PhotoCommentRow[];
};

type PhotoCommentErrorResponse = {
  error?: string;
};

type CommentAsyncStatus = "idle" | "loading" | "posting";

const dedupeById = (items: PhotoItem[]) => {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
};

const sortByTakenAtDesc = (left: PhotoItem, right: PhotoItem) => {
  return +new Date(right.takenAt) - +new Date(left.takenAt);
};

const buildMonthGroups = (items: PhotoItem[]): MonthGroup[] => {
  const groups = new Map<string, MonthGroup>();

  for (const item of [...items].sort(sortByTakenAtDesc)) {
    const date = new Date(item.takenAt);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: `${year}년 ${month}월`,
        year,
        month,
        latestTakenAt: item.takenAt,
        latestUpdatedAt: item.updatedAt,
        items: [],
      });
    }

    const group = groups.get(key);

    if (!group) {
      continue;
    }

    group.items.push(item);

    if (+new Date(item.updatedAt) > +new Date(group.latestUpdatedAt)) {
      group.latestUpdatedAt = item.updatedAt;
    }
  }

  return [...groups.values()].sort((left, right) => {
    return +new Date(right.latestTakenAt) - +new Date(left.latestTakenAt);
  });
};

const formatDateLabel = (takenAt: string) => {
  const date = new Date(takenAt);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export function GallerySection({ initialData, initialHighlights, initialFilter }: GallerySectionProps) {
  const [items, setItems] = useState<PhotoItem[]>(() => initialData.items);
  const [summary, setSummary] = useState<PhotoListResponse["summary"]>(
    initialData.summary,
  );
  const [highlights, setHighlights] = useState<HighlightResponse>(initialHighlights);
  const [nextCursor, setNextCursor] = useState<string | null>(initialData.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [openMonthKeys, setOpenMonthKeys] = useState<string[]>(() => {
    const groups = buildMonthGroups(initialData.items);
    return groups.slice(0, 2).map((group) => group.key);
  });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [pendingJumpKey, setPendingJumpKey] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
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
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const highlightsRef = useRef<HTMLElement | null>(null);
  const lightboxPanelRef = useRef<HTMLDivElement | null>(null);
  const lightboxImageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setItems(initialData.items);
    setSummary(initialData.summary);
    setHighlights(initialHighlights);
    setNextCursor(initialData.nextCursor);
    setPendingJumpKey(null);

    const groups = buildMonthGroups(initialData.items);
    setOpenMonthKeys(groups.slice(0, 2).map((group) => group.key));
    setSelectedYear(groups[0]?.year ?? null);
  }, [initialData, initialHighlights]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduceMotion(media.matches);
    };

    update();
    media.addEventListener("change", update);

    return () => {
      media.removeEventListener("change", update);
    };
  }, []);

  const monthGroups = useMemo(() => buildMonthGroups(items), [items]);
  const monthStatMap = useMemo(
    () => new Map(summary.yearMonthStats.map((stat) => [stat.key, stat])),
    [summary.yearMonthStats],
  );

  const years = useMemo(() => {
    return Array.from(new Set(summary.yearMonthStats.map((stat) => stat.year)));
  }, [summary.yearMonthStats]);

  useEffect(() => {
    if (selectedYear || years.length === 0) {
      return;
    }

    setSelectedYear(years[0]);
  }, [selectedYear, years]);

  const visibleMonthGroups = useMemo(() => {
    if (!selectedYear) {
      return monthGroups;
    }

    return monthGroups.filter((group) => group.year === selectedYear);
  }, [monthGroups, selectedYear]);
  const visibleMonthStats = useMemo(() => {
    if (!selectedYear) {
      return summary.yearMonthStats;
    }

    return summary.yearMonthStats.filter((stat) => stat.year === selectedYear);
  }, [selectedYear, summary.yearMonthStats]);

  const effectiveHighlights = useMemo(() => {
    const featured = highlights.featured.length > 0 ? highlights.featured : items.slice(0, 2);
    const highlightItems = highlights.highlights.length > 0 ? highlights.highlights : items.slice(2, 8);

    return {
      featured,
      highlights: highlightItems,
    };
  }, [highlights, items]);
  const tagAlbums = useMemo(() => groupPhotosByTag(items), [items]);
  const activeTagItems = useMemo(() => {
    if (!activeTag) {
      return [];
    }

    return items.filter((item) => getPhotoTags(item).includes(activeTag));
  }, [activeTag, items]);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const highlightCount =
      effectiveHighlights.featured.length + effectiveHighlights.highlights.length;

    if (highlightCount === 0) {
      return;
    }

    const section = highlightsRef.current;

    if (!section) {
      return;
    }

    const cards = section.querySelectorAll<HTMLElement>("[data-highlight-card]");

    if (cards.length === 0) {
      return;
    }

    const tween = gsap.fromTo(
      cards,
      { opacity: 0, y: 10, scale: 0.986 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.34,
        ease: "power2.out",
        stagger: 0.05,
      },
    );

    return () => {
      tween.kill();
    };
  }, [reduceMotion, effectiveHighlights]);

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
      .fromTo(panel, { opacity: 0, y: 12, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.26 })
      .fromTo(imageWrap, { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 0.22 }, "<0.03");

    return () => {
      timeline.kill();
    };
  }, [lightbox, lightbox?.index, reduceMotion]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams({
        cursor: nextCursor,
        limit: `${PAGE_LIMIT}`,
      });

      if (initialFilter?.year) {
        params.set("year", `${initialFilter.year}`);
      }

      if (initialFilter?.month) {
        params.set("month", `${initialFilter.month}`);
      }

      if (initialFilter?.day) {
        params.set("day", `${initialFilter.day}`);
      }

      const response = await fetch(`/api/photos?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const body = (await response.json()) as PhotoListResponse | { error?: string };

      if (!response.ok || !(body as PhotoListResponse).items) {
        throw new Error((body as { error?: string }).error || "사진을 이어서 불러오지 못했어요.");
      }

      const page = body as PhotoListResponse;

      setItems((current) => dedupeById([...current, ...page.items]).sort(sortByTakenAtDesc));
      setSummary(page.summary);
      setNextCursor(page.nextCursor);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "사진을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextCursor, initialFilter]);

  useEffect(() => {
    if (!sentinelRef.current || !nextCursor || isLoadingMore) {
      return;
    }

    const target = sentinelRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry?.isIntersecting) {
          return;
        }

        void loadMore();
      },
      { rootMargin: "160px 0px" },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [isLoadingMore, loadMore, nextCursor]);

  useEffect(() => {
    if (!pendingJumpKey) {
      return;
    }

    const target = document.getElementById(`archive-${pendingJumpKey}`);

    if (target) {
      target.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      setPendingJumpKey(null);
      return;
    }

    if (nextCursor && !isLoadingMore) {
      void loadMore();
      return;
    }

    if (!nextCursor && !isLoadingMore) {
      setPendingJumpKey(null);
      setLoadError("선택한 월에는 아직 사진이 없어요.");
    }
  }, [isLoadingMore, loadMore, nextCursor, pendingJumpKey, reduceMotion]);

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
      setCommentError(
        error instanceof Error ? error.message : "댓글을 불러오지 못했어요.",
      );
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
      setCommentError(
        error instanceof Error ? error.message : "댓글 등록에 실패했어요.",
      );
    } finally {
      setCommentStatus("idle");
    }
  };

  const toggleMonth = (monthKey: string) => {
    setOpenMonthKeys((current) =>
      current.includes(monthKey)
        ? current.filter((key) => key !== monthKey)
        : [...current, monthKey],
    );
  };

  const jumpToMonth = (monthKey: string) => {
    const target = document.getElementById(`archive-${monthKey}`);

    if (!target) {
      setPendingJumpKey(monthKey);
      return;
    }

    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const openYear = (year: number) => {
    setSelectedYear(year);

    const firstMonth = summary.yearMonthStats.find((stat) => stat.year === year);

    if (firstMonth) {
      jumpToMonth(firstMonth.key);
    }
  };

  const selectedMonthMeta = (group: MonthGroup): YearMonthStat | null => {
    return monthStatMap.get(group.key) ?? null;
  };

  if (items.length === 0) {
    return (
      <section
        id="gallery"
        className="scroll-mt-24 w-full rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)] p-4 shadow-[var(--shadow-soft)]"
      >
        <h2 className="text-[length:var(--text-section-title)] font-bold text-[color:var(--color-ink)]">
          아직 공개된 사진이 없어요
        </h2>
        <p className="mt-2 text-sm text-[color:var(--color-muted)]">첫 사진이 올라오면 여기에 바로 보여드릴게요.</p>
        <p className="mt-1 text-[0.84rem] text-[color:var(--color-muted)]">
          관리 페이지에서 업로드하면 앨범에 자동 반영됩니다.
        </p>
        <Link
          href="/admin"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white"
        >
          첫 사진 올리러 가기
        </Link>
      </section>
    );
  }

  const lightboxOverlay = selectedImage ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-3 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="갤러리 이미지 크게 보기"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeLightbox();
        }
      }}
    >
      <div
        ref={lightboxPanelRef}
        className="w-full max-w-3xl overflow-hidden rounded-[1.2rem] border border-white/10 bg-black"
      >
        <div ref={lightboxImageRef}>
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
          <form className="space-y-2" onSubmit={handleSubmitComment}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={commentNickname}
                onChange={(event) => setCommentNickname(event.target.value)}
                placeholder="닉네임"
                className="min-h-11 w-[7rem] rounded-full border border-white/20 bg-white/10 px-3 text-[0.78rem] text-white placeholder:text-white/60"
                maxLength={24}
              />
              <input
                type="text"
                value={commentMessage}
                onChange={(event) => setCommentMessage(event.target.value)}
                placeholder="이 사진에 댓글 남기기"
                className="min-h-11 flex-1 rounded-full border border-white/20 bg-white/10 px-3 text-[0.82rem] text-white placeholder:text-white/60"
                maxLength={MAX_PHOTO_COMMENT_LENGTH}
              />
              <button
                type="submit"
                disabled={commentStatus === "posting"}
                className="min-h-11 rounded-full bg-white/20 px-3.5 text-[0.78rem] font-semibold text-white disabled:opacity-60"
              >
                {commentStatus === "posting" ? "등록 중…" : "댓글 등록"}
              </button>
            </div>
            <div className="flex items-center justify-between text-[0.68rem] text-white/70">
              <span>{selectedPhotoComments.length}개 댓글</span>
              <span>{remainingCommentChars}자 남음</span>
            </div>
          </form>

          {commentError ? (
            <p className="mt-1 rounded-[0.7rem] border border-rose-200/60 bg-rose-500/10 px-2.5 py-1.5 text-[0.72rem] text-rose-100">
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
                className="rounded-[0.75rem] border border-white/12 bg-white/8 px-2.5 py-2"
              >
                <header className="flex items-center justify-between gap-2">
                  <strong className="text-[0.74rem] font-semibold text-white/92">{comment.nickname}</strong>
                  <time className="text-[0.66rem] text-white/60">
                    {commentDateFormatter.format(new Date(comment.created_at))}
                  </time>
                </header>
                <p className="mt-1 whitespace-pre-wrap text-[0.78rem] leading-[1.45] text-white/90">
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
        className="scroll-mt-24 w-full rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-[color:var(--color-surface-strong)] p-3.5 shadow-[var(--shadow-soft)] sm:p-4.5"
      >
        <div className="mb-4">
          <h2 className="text-[length:var(--text-section-title)] font-bold leading-tight text-[color:var(--color-ink)]">
            루다의 새 순간
          </h2>
          <p className="mt-1 text-[0.82rem] text-[color:var(--color-muted)]">
            대표컷부터 월별 아카이브까지 한 번에 감상해요.
          </p>
        </div>

        <section className="mb-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`rounded-full px-3 py-1.5 text-[0.75rem] font-semibold ${viewMode === "timeline"
                ? "bg-[color:var(--color-brand)] text-white"
                : "border border-[color:var(--color-line)] bg-white text-[color:var(--color-muted)]"
                }`}
            >
              월별 보기
            </button>
            <button
              type="button"
              onClick={() => setViewMode("tags")}
              className={`rounded-full px-3 py-1.5 text-[0.75rem] font-semibold ${viewMode === "tags"
                ? "bg-[color:var(--color-brand)] text-white"
                : "border border-[color:var(--color-line)] bg-white text-[color:var(--color-muted)]"
                }`}
            >
              태그 모아보기
            </button>
          </div>

          {viewMode === "tags" ? (
            activeTag ? (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[0.82rem] font-semibold text-[color:var(--color-ink)]">#{activeTag}</p>
                  <button
                    type="button"
                    onClick={() => setActiveTag(null)}
                    className="rounded-full bg-[color:var(--color-brand-soft)] px-3 py-1 text-[0.72rem] font-semibold text-[color:var(--color-brand-strong)]"
                  >
                    태그 목록
                  </button>
                </div>
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
              </>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
                {tagAlbums.map((album) => (
                  <button
                    key={`album-${album.tag}`}
                    type="button"
                    onClick={() => setActiveTag(album.tag)}
                    className="overflow-hidden rounded-[0.9rem] border border-[color:var(--color-line)] bg-white text-left"
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
        <section id="gallery-highlights" ref={highlightsRef} className="mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[1rem] font-semibold text-[color:var(--color-ink)]">이번 주 대표컷</h3>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {effectiveHighlights.featured.map((image, index) => (
              <button
                key={`featured-${image.id}`}
                data-highlight-card
                type="button"
                onClick={(event) => openLightbox(effectiveHighlights.featured, index, event.currentTarget)}
                className="group relative overflow-hidden rounded-[0.96rem] bg-[color:var(--color-brand-soft)] text-left shadow-[var(--shadow-soft)]"
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
                  <p className="text-[0.78rem] font-semibold text-white/95">{image.caption}</p>
                  <p className="text-[0.66rem] text-white/78">{formatDateLabel(image.takenAt)}</p>
                </div>
              </button>
            ))}
          </div>

          {effectiveHighlights.highlights.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
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
        <section id="monthly-archive" className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {years.map((year) => (
              <button
                key={`year-${year}`}
                type="button"
                onClick={() => openYear(year)}
                className={`rounded-full px-3 py-1.5 text-[0.74rem] font-semibold transition-colors ${selectedYear === year
                  ? "bg-[color:var(--color-brand)] text-white"
                  : "border border-[color:var(--color-line)] bg-white text-[color:var(--color-muted)]"
                  }`}
              >
                {year}년
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleMonthStats.map((group) => (
              <button
                key={`${group.key}-jump`}
                type="button"
                onClick={() => jumpToMonth(group.key)}
                className="shrink-0 rounded-full border border-[color:var(--color-line)] bg-white px-3 py-1.5 text-[0.72rem] font-semibold text-[color:var(--color-muted)]"
              >
                {group.month}월
              </button>
            ))}
          </div>

          {visibleMonthGroups.map((group) => {
            const monthStat = selectedMonthMeta(group);
            const isOpen = openMonthKeys.includes(group.key);
            const metaLabel =
              monthStat?.metaLabel ??
              formatMonthMetaLabel(
                group.year,
                group.month,
                group.items.length,
                group.latestUpdatedAt,
              );

            return (
              <article
                key={group.key}
                id={`archive-${group.key}`}
                className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] shadow-[var(--shadow-soft)]"
              >
                <button
                  type="button"
                  onClick={() => toggleMonth(group.key)}
                  aria-expanded={isOpen}
                  aria-label={`${group.label} ${isOpen ? "접기" : "펼치기"}`}
                  className="flex min-h-[3.1rem] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
                >
                  <div>
                    <p className="text-[0.98rem] font-semibold text-[color:var(--color-ink)]">{group.label}</p>
                    <p className="mt-1 text-[0.72rem] font-medium text-[color:var(--color-muted)]">{metaLabel}</p>
                  </div>
                  <span className="text-base font-semibold text-[color:var(--color-muted)]">{isOpen ? "−" : "+"}</span>
                </button>

                {isOpen ? (
                  <div className="grid grid-cols-2 gap-1.5 border-t border-[color:var(--color-line)] p-2 md:grid-cols-3">
                    {group.items.map((image, index) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={(event) => openLightbox(group.items, index, event.currentTarget)}
                        className="group relative overflow-hidden rounded-[0.9rem] bg-[color:var(--color-brand-soft)] text-left shadow-[var(--shadow-soft)]"
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
              </article>
            );
          })}
        </section>
        ) : null}

        <div ref={sentinelRef} className="mt-4 h-1 w-full" aria-hidden="true" />

        {isLoadingMore ? (
          <p
            className="mt-3 rounded-[0.95rem] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2 text-[0.84rem] text-[color:var(--color-muted)]"
            aria-live="polite"
          >
            사진을 이어서 불러오는 중이에요…
          </p>
        ) : null}

        {loadError ? (
          <div
            className="mt-3 flex flex-wrap items-center gap-2 rounded-[0.95rem] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.84rem] text-rose-700"
            role="alert"
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => void loadMore()}
              className="inline-flex min-h-11 items-center rounded-full border border-rose-200 bg-white px-3 text-[0.78rem] font-semibold"
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {nextCursor && !isLoadingMore ? (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--color-line)] bg-white px-4 text-sm font-semibold text-[color:var(--color-muted)]"
          >
              사진 더 보기
            </button>
          ) : null}
      </section>

      {portalRoot && lightboxOverlay ? createPortal(lightboxOverlay, portalRoot) : null}
    </>
  );
}
