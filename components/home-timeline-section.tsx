"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PhotoItem, PostTimelineResponse } from "@/lib/gallery/types";

type HomeTimelineSectionProps = {
  initialItems: PhotoItem[];
  initialNextCursor: string | null;
};

type TimelinePost = {
  id: string;
  caption: string;
  takenAt: string;
  photos: PhotoItem[];
};

const PAGE_SIZE = 10;

const dedupeById = (items: PhotoItem[]) => {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
};

const buildTimelinePosts = (itemsDesc: PhotoItem[]): TimelinePost[] => {
  const postByKey = new Map<string, TimelinePost>();
  const orderedKeys: string[] = [];

  for (const item of itemsDesc) {
    const key = Number.isNaN(new Date(item.takenAt).getTime())
      ? item.takenAt
      : item.takenAt.slice(0, 16);
    const existing = postByKey.get(key);

    if (existing) {
      existing.photos.push(item);
      continue;
    }

    orderedKeys.push(key);
    postByKey.set(key, {
      id: item.id,
      caption: item.caption,
      takenAt: item.takenAt,
      photos: [item],
    });
  }

  return orderedKeys
    .map((key) => postByKey.get(key))
    .filter((post): post is TimelinePost => post !== undefined);
};

const buildPostDetailLink = (postId: string) => {
  return `/posts/${encodeURIComponent(postId)}`;
};

const toKoreanDateTime = (iso: string) => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
};

export function HomeTimelineSection({
  initialItems,
  initialNextCursor,
}: HomeTimelineSectionProps) {
  const [itemsDesc, setItemsDesc] = useState<PhotoItem[]>(() => dedupeById(initialItems));
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Record<string, true>>({});

  const inFlightCursorRef = useRef<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const timelinePosts = useMemo(() => buildTimelinePosts(itemsDesc), [itemsDesc]);

  const hasMore = nextCursor !== null;
  const secondBottomPostId =
    timelinePosts.length >= 2 ? timelinePosts[timelinePosts.length - 2]?.id ?? null : null;

  const loadOlderPosts = useCallback(async () => {
    if (isLoading || !nextCursor) {
      return;
    }

    if (inFlightCursorRef.current === nextCursor) {
      return;
    }

    setIsLoading(true);
    setError(null);
    inFlightCursorRef.current = nextCursor;

    try {
      const response = await fetch(
        `/api/posts/timeline?cursor=${encodeURIComponent(nextCursor)}&limit=${PAGE_SIZE}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const body = (await response.json()) as PostTimelineResponse | { error?: string };

      if (!response.ok || !("items" in body)) {
        const message =
          "error" in body && typeof body.error === "string"
            ? body.error
            : "게시글을 더 불러오지 못했어요.";
        throw new Error(message);
      }

      const payload = body as PostTimelineResponse;
      setItemsDesc((current) => dedupeById([...current, ...payload.items]));
      setNextCursor(payload.nextCursor);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "게시글을 더 불러오지 못했어요.",
      );
    } finally {
      setIsLoading(false);
      inFlightCursorRef.current = null;
    }
  }, [isLoading, nextCursor]);

  const markPhotoBroken = useCallback((photoId: string) => {
    setBrokenPhotoIds((current) => {
      if (current[photoId]) {
        return current;
      }

      return {
        ...current,
        [photoId]: true,
      };
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !secondBottomPostId || !hasMore) {
      return;
    }

    const target = cardRefs.current[secondBottomPostId];

    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadOlderPosts();
        }
      },
      {
        root: null,
        threshold: 0.08,
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadOlderPosts, secondBottomPostId]);

  if (timelinePosts.length === 0) {
    return (
      <section className="layout-container mt-[var(--space-section-sm)]">
        <div className="ui-surface rounded-[var(--radius-lg)] p-4 sm:p-5">
          <h2 className="ui-title">타임라인이 아직 비어있어요</h2>
          <p className="mt-2 text-[0.85rem] text-[color:var(--color-muted)]">
            첫 사진이 올라오면 여기서부터 순서대로 보여드릴게요.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="layout-container mt-[var(--space-section-sm)]">
      <div className="ui-surface rounded-[var(--radius-lg)] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="ui-title">루다 타임라인</h2>
          <p className="text-[0.74rem] text-[color:var(--color-muted)]">
            최신 게시글이 위에 먼저 보여요.
          </p>
        </div>

        {isLoading ? (
          <p className="mb-2 text-[0.75rem] text-[color:var(--color-muted)]">
            이전 게시글을 불러오는 중…
          </p>
        ) : null}

        {error ? (
          <div className="mb-2 flex items-center gap-2 rounded-[0.85rem] border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-[0.74rem] text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => void loadOlderPosts()}
              disabled={!hasMore || isLoading}
              className="ui-btn ui-btn-secondary ml-auto px-3 text-[0.72rem] disabled:opacity-60"
            >
              다시 시도
            </button>
          </div>
        ) : null}

        <ul className="space-y-3">
          {timelinePosts.map((post) => (
            <li
              key={post.id}
              ref={(node) => {
                cardRefs.current[post.id] = node;
              }}
              data-post-id={post.id}
              data-photo-count={post.photos.length}
              data-testid={`home-post-card-${post.id}`}
              className="overflow-hidden rounded-[1rem] border border-[color:var(--color-line)] bg-white"
            >
              <Link
                href={buildPostDetailLink(post.id)}
                className="block"
                aria-label={`${post.caption} 사진 상세 보기`}
              >
                {post.photos.length > 1 ? (
                  <div className="grid grid-cols-3 gap-1.5 p-2">
                    {post.photos.slice(0, 10).map((photo, index, array) => {
                      const remaining = post.photos.length - array.length;
                      const shouldShowMoreOverlay = index === array.length - 1 && remaining > 0;

                      return (
                        <div key={photo.id} className="relative overflow-hidden rounded-[0.72rem]">
                          {brokenPhotoIds[photo.id] ? (
                            <div className="flex aspect-square w-full items-center justify-center bg-[color:var(--color-surface)] text-[0.72rem] text-[color:var(--color-muted)]">
                              미리보기 없음
                            </div>
                          ) : (
                            <Image
                              src={photo.thumbSrc ?? photo.src}
                              alt={photo.alt}
                              width={900}
                              height={900}
                              sizes="(max-width: 640px) 44vw, 340px"
                              className="aspect-square w-full object-cover"
                              onError={() => markPhotoBroken(photo.id)}
                            />
                          )}
                          {shouldShowMoreOverlay ? (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[0.92rem] font-semibold text-white">
                              +{remaining}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    {brokenPhotoIds[post.photos[0]?.id ?? ""] ? (
                      <div className="flex aspect-[4/5] w-full items-center justify-center bg-[color:var(--color-surface)] text-[0.78rem] text-[color:var(--color-muted)]">
                        이미지 미리보기를 불러오지 못했어요.
                      </div>
                    ) : (
                      <Image
                        src={post.photos[0]?.thumbSrc ?? post.photos[0]?.src ?? ""}
                        alt={post.photos[0]?.alt ?? post.caption}
                        width={1200}
                        height={1200}
                        sizes="(max-width: 640px) 92vw, 720px"
                        className="aspect-[4/5] w-full object-cover"
                        onError={() => {
                          const photoId = post.photos[0]?.id;
                          if (photoId) {
                            markPhotoBroken(photoId);
                          }
                        }}
                      />
                    )}
                  </>
                )}
                <div className="space-y-1 px-3 py-2.5">
                  <p className="text-[0.8rem] font-semibold text-[color:var(--color-ink)]">
                    {post.caption}
                  </p>
                  <p className="text-[0.72rem] text-[color:var(--color-muted)]">
                    {toKoreanDateTime(post.takenAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
