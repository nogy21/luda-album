"use client";

import Image from "next/image";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type {
  CreatePhotoCommentPayload,
  PhotoCommentRow,
} from "@/lib/gallery/comment-types";
import { MAX_PHOTO_COMMENT_LENGTH } from "@/lib/gallery/comment-validation";
import type { PhotoItem } from "@/lib/gallery/types";
import { getPhotoTags } from "@/lib/gallery/tags";
import { usePhotoGestures } from "@/lib/ui/photo-gestures";
import { usePhotoViewerMode } from "@/lib/ui/photo-viewer-mode";
import { lockPageScroll, unlockPageScroll } from "@/lib/ui/scroll-lock";

type LightboxState = {
  items: PhotoItem[];
  index: number;
};

type GalleryLightboxProps = {
  lightbox: LightboxState;
  lightboxDirection: -1 | 0 | 1;
  onMoveLightbox: (step: number) => void;
  onRequestClose: () => void;
};

type PhotoCommentsResponse = {
  items: PhotoCommentRow[];
};

type PhotoCommentErrorResponse = {
  error?: string;
};

type CommentAsyncStatus = "idle" | "loading" | "posting";

const IMMERSIVE_GESTURE_HINT_KEY = "luda:photo-viewer:gesture-hint:v1";

const formatDateLabel = (takenAt: string) => {
  const date = new Date(takenAt);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export function GalleryLightbox({
  lightbox,
  lightboxDirection,
  onMoveLightbox,
  onRequestClose,
}: GalleryLightboxProps) {
  const [commentsByPhotoId, setCommentsByPhotoId] = useState<Record<string, PhotoCommentRow[]>>(
    {},
  );
  const [commentNickname, setCommentNickname] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [commentStatus, setCommentStatus] = useState<CommentAsyncStatus>("idle");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isGestureHintDismissed, setIsGestureHintDismissed] = useState(false);

  const selectedImage = lightbox.items[lightbox.index] ?? null;
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

  const lightboxImmersiveRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

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

  const requestClose = useCallback(() => {
    const close = () => {
      onRequestClose();
    };

    void exitLightboxImmersive().finally(close);
  }, [exitLightboxImmersive, onRequestClose]);

  const dismissGestureHint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(IMMERSIVE_GESTURE_HINT_KEY, "seen");
    }

    setIsGestureHintDismissed(true);
  }, []);

  const {
    isZoomed: isLightboxZoomed,
    transformStyle: lightboxTransformStyle,
    bind: lightboxGestureBind,
    resetTransform: resetLightboxTransform,
  } = usePhotoGestures({
    enabled: Boolean(selectedImage && isLightboxImmersive),
    onNavigatePrev: lightbox.items.length > 1 ? () => onMoveLightbox(-1) : undefined,
    onNavigateNext: lightbox.items.length > 1 ? () => onMoveLightbox(1) : undefined,
  });

  useEffect(() => {
    const snapshot = lockPageScroll();

    return () => {
      unlockPageScroll(snapshot);
    };
  }, []);

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
    if (!selectedImage || lightbox.items.length < 2 || typeof window === "undefined") {
      return;
    }

    const nextItem = lightbox.items[(lightbox.index + 1) % lightbox.items.length];
    const prevItem =
      lightbox.items[(lightbox.index - 1 + lightbox.items.length) % lightbox.items.length];
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isLightboxImmersive) {
          event.preventDefault();
          void exitLightboxImmersive();
          return;
        }

        requestClose();
        return;
      }

      if (event.key === "ArrowLeft") {
        onMoveLightbox(-1);
      }

      if (event.key === "ArrowRight") {
        onMoveLightbox(1);
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
    exitLightboxImmersive,
    isLightboxImmersive,
    onMoveLightbox,
    requestClose,
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
  }, [commentsByPhotoId, loadPhotoComments, selectedImage]);

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

  const portalRoot = typeof document !== "undefined" ? document.body : null;

  if (!portalRoot || !selectedImage) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
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

            requestClose();
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
                    onClick={requestClose}
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
                <div className="absolute inset-x-0 bottom-[max(0.62rem,env(safe-area-inset-bottom))] flex justify-center px-2.5">
                  <div className="photo-viewer-control-row flex max-w-full items-center gap-1.5 rounded-full border border-white/18 bg-black/58 px-2 py-1.5 backdrop-blur-sm">
                    {lightbox.items.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onMoveLightbox(-1)}
                          className="ui-btn photo-viewer-control shrink-0 border-white/24 bg-white/10 px-2.5 text-[0.72rem] text-white hover:bg-white/20"
                          aria-label="이전 사진"
                        >
                          이전
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveLightbox(1)}
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
                  <p className="text-[0.7rem] text-white/70">{formatDateLabel(selectedImage.takenAt)}</p>
                  <p className="text-[0.66rem] text-white/60">
                    {getPhotoTags(selectedImage).join(", ")}
                  </p>
                </div>
                <div className="photo-viewer-control-row flex items-center gap-1.25 pb-0.5">
                  {lightbox.items.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onMoveLightbox(-1)}
                        className="photo-viewer-control min-h-10 min-w-10 shrink-0 rounded-full bg-white/15 px-2.5 text-base font-semibold text-white"
                        aria-label="이전 사진"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveLightbox(1)}
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
                    onClick={requestClose}
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
    </AnimatePresence>,
    portalRoot,
  );
}
