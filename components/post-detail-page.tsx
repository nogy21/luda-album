"use client";

import Image from "next/image";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { GalleryLightbox } from "./gallery-lightbox";
import type {
  CreatePhotoCommentPayload,
  PhotoCommentRow,
} from "@/lib/gallery/comment-types";
import { MAX_PHOTO_COMMENT_LENGTH } from "@/lib/gallery/comment-validation";
import type { PhotoItem, TimelinePostDetail } from "@/lib/gallery/types";

type PostDetailPageProps = {
  post: TimelinePostDetail;
};

type PostCommentsResponse = {
  items: PhotoCommentRow[];
};

type PostCommentErrorResponse = {
  error?: string;
};

type CommentAsyncStatus = "idle" | "loading" | "posting";

type LightboxState = {
  items: PhotoItem[];
  index: number;
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

export function PostDetailPage({ post }: PostDetailPageProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [lightboxDirection, setLightboxDirection] = useState<-1 | 0 | 1>(0);
  const [comments, setComments] = useState<PhotoCommentRow[]>([]);
  const [commentNickname, setCommentNickname] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [commentStatus, setCommentStatus] = useState<CommentAsyncStatus>("loading");
  const [commentError, setCommentError] = useState<string | null>(null);

  const remainingCommentChars = useMemo(
    () => MAX_PHOTO_COMMENT_LENGTH - commentMessage.length,
    [commentMessage.length],
  );
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
  const commentEndpoint = `/api/photos/${encodeURIComponent(post.commentPhotoId)}/comments`;

  const moveLightbox = useCallback((step: number) => {
    setLightboxDirection(step > 0 ? 1 : -1);
    setLightbox((current) => {
      if (!current || current.items.length === 0) {
        return current;
      }

      const nextIndex = (current.index + step + current.items.length) % current.items.length;

      return {
        ...current,
        index: nextIndex,
      };
    });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxDirection(0);
    setLightbox(null);
  }, []);

  const loadComments = useCallback(async () => {
    setCommentStatus("loading");
    setCommentError(null);

    try {
      const response = await fetch(commentEndpoint, {
        method: "GET",
        cache: "no-store",
      });
      const body = (await response.json()) as PostCommentsResponse | PostCommentErrorResponse;

      if (!response.ok || !(body as PostCommentsResponse).items) {
        throw new Error((body as PostCommentErrorResponse).error || "댓글을 불러오지 못했어요.");
      }

      setComments((body as PostCommentsResponse).items);
      setCommentStatus("idle");
    } catch (error) {
      setCommentStatus("idle");
      setCommentError(error instanceof Error ? error.message : "댓글을 불러오지 못했어요.");
    }
  }, [commentEndpoint]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (commentStatus === "posting") {
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
      const response = await fetch(commentEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as PhotoCommentRow | PostCommentErrorResponse;

      if (!response.ok || !(body as PhotoCommentRow).id) {
        throw new Error((body as PostCommentErrorResponse).error || "댓글 등록에 실패했어요.");
      }

      const created = body as PhotoCommentRow;
      setComments((current) => [created, ...current]);
      setCommentMessage("");
      setCommentStatus("idle");
    } catch (error) {
      setCommentStatus("idle");
      setCommentError(error instanceof Error ? error.message : "댓글 등록에 실패했어요.");
    }
  };

  return (
    <>
      <section className="layout-container mt-[var(--space-section-sm)]">
        <div className="ui-surface rounded-[var(--radius-lg)] p-4 sm:p-5">
          <header className="mb-3">
            <p className="ui-eyebrow">게시글 상세</p>
            <h1 className="mt-1 text-[1.08rem] font-semibold text-[color:var(--color-ink)]">{post.caption}</h1>
            <p className="mt-1 text-[0.74rem] text-[color:var(--color-muted)]">
              {toKoreanDateTime(post.takenAt)} · 사진 {post.photos.length}장
            </p>
          </header>

          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {post.photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => {
                  setLightboxDirection(0);
                  setLightbox({
                    items: post.photos,
                    index,
                  });
                }}
                aria-label={`${index + 1}번 사진 보기`}
                className="overflow-hidden rounded-[0.72rem] bg-[color:var(--color-surface)]"
              >
                <Image
                  src={photo.thumbSrc ?? photo.src}
                  alt={photo.alt}
                  width={900}
                  height={900}
                  sizes="(max-width: 640px) 31vw, 220px"
                  className="aspect-square w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="ui-surface mt-[var(--space-section-sm)] rounded-[var(--radius-lg)] p-4 sm:p-5">
          <h2 className="ui-title">댓글</h2>
          <p className="mt-1 text-[0.74rem] text-[color:var(--color-muted)]">최신순 · {comments.length}개</p>

          <form className="mt-3 rounded-[0.95rem] border border-[color:var(--color-line)] p-3" onSubmit={handleSubmitComment}>
            <label htmlFor="post-comment-message" className="sr-only">
              댓글 내용
            </label>
            <textarea
              id="post-comment-message"
              value={commentMessage}
              onChange={(event) => {
                setCommentMessage(event.target.value);
                if (commentError) {
                  setCommentError(null);
                }
              }}
              placeholder="댓글을 남겨주세요"
              className="ui-input min-h-[4rem] w-full resize-none px-3 py-2 text-[0.84rem]"
              maxLength={MAX_PHOTO_COMMENT_LENGTH}
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <label htmlFor="post-comment-nickname" className="sr-only">
                닉네임
              </label>
              <input
                id="post-comment-nickname"
                type="text"
                value={commentNickname}
                onChange={(event) => setCommentNickname(event.target.value)}
                placeholder="닉네임(선택)"
                className="ui-input min-h-10 w-[8.2rem] rounded-full px-3 text-[0.76rem]"
                maxLength={24}
              />
              <span className="text-[0.7rem] text-[color:var(--color-muted)]">{remainingCommentChars}자 남음</span>
              <button
                type="submit"
                disabled={commentStatus === "posting"}
                className="ui-btn ui-btn-primary ml-auto rounded-full px-3.5 text-[0.76rem] disabled:opacity-60"
              >
                {commentStatus === "posting" ? "남기는 중…" : "남기기"}
              </button>
            </div>
          </form>

          {commentError ? (
            <p className="mt-2 rounded-[0.72rem] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.74rem] text-rose-700">
              {commentError}
            </p>
          ) : null}

          <div className="mt-3 space-y-2">
            {commentStatus === "loading" ? (
              <p className="text-[0.78rem] text-[color:var(--color-muted)]">댓글을 불러오는 중…</p>
            ) : null}
            {commentStatus !== "loading" && comments.length === 0 ? (
              <p className="text-[0.78rem] text-[color:var(--color-muted)]">첫 댓글을 남겨주세요.</p>
            ) : null}
            {comments.map((comment) => (
              <article
                key={comment.id}
                className="rounded-[0.78rem] border border-[color:var(--color-line)] bg-[color:var(--color-surface-alt)] px-3 py-2"
              >
                <header className="flex items-center justify-between gap-2">
                  <strong className="text-[0.78rem] font-semibold text-[color:var(--color-ink)]">
                    {comment.nickname}
                  </strong>
                  <time className="text-[0.68rem] text-[color:var(--color-muted)]">
                    {commentDateFormatter.format(new Date(comment.created_at))}
                  </time>
                </header>
                <p className="mt-1 whitespace-pre-wrap text-[0.8rem] leading-[1.45] text-[color:var(--color-ink)]">
                  {comment.message}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {lightbox ? (
        <GalleryLightbox
          lightbox={lightbox}
          lightboxDirection={lightboxDirection}
          onMoveLightbox={moveLightbox}
          onRequestClose={closeLightbox}
        />
      ) : null}
    </>
  );
}
