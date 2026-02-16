"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createUploadQueue,
  getQueueSummary,
  markUploadError,
  markUploadSuccess,
  pickRetryTargets,
  setUploadProgress,
  toDateTimeLocalInputValue,
  type UploadQueueItem,
} from "@/lib/admin/upload-queue";
import {
  MAX_EVENT_NAME_COUNT,
  MAX_EVENT_NAME_LENGTH,
  normalizeEventLabel,
  sanitizeEventNames,
} from "@/lib/gallery/event-names";
import { extractPhotoUploadMetadata } from "@/lib/gallery/upload-metadata";

type UploadApiResult = {
  uploaded?: Array<{
    id: string;
    path: string;
    name: string;
    visibility: "family" | "admin";
  }>;
  failed?: Array<{ reason: string; name: string }>;
  error?: { message?: string };
};

type UploadResult = {
  ok: boolean;
  uploadedPath?: string;
  uploadedPhotoId?: string;
  visibility?: "family" | "admin";
  errorReason?: string;
};

type UploadMetadataPayload = {
  caption: string;
  takenAt: string;
  eventNames: string[];
};

type AdminPhotoItem = {
  id: string;
  src: string;
  thumbSrc: string | null;
  caption: string;
  eventNames: string[];
  takenAt: string;
  visibility: "family" | "admin";
  isFeatured: boolean;
  featuredRank: number | null;
};

type AdminPhotosApiResult = {
  items?: AdminPhotoItem[];
  nextCursor?: string | null;
  error?: { message?: string };
};

type AdminEventsApiResult = {
  items?: string[];
  error?: { message?: string };
};

type PwaBrandingState = {
  icons: {
    icon192: string;
    icon512: string;
    maskable512: string;
    appleTouch: string;
  };
  version: string;
  isCustom: boolean;
};

type AdminPwaBrandingApiResult = {
  branding?: PwaBrandingState;
  error?: { message?: string };
};

const PAGE_LIMIT = 24;
const MAX_CAPTION_LENGTH = 120;
const MAX_PWA_LOGO_SIZE_BYTES = 10 * 1024 * 1024;
const LARGE_QUEUE_COMPACT_THRESHOLD = 16;
const QUEUE_RENDER_STEP = 24;

type QueueFilter = "all" | UploadQueueItem["status"];

const QUEUE_FILTERS: Array<{
  key: QueueFilter;
  label: string;
}> = [
  { key: "all", label: "전체" },
  { key: "queued", label: "대기" },
  { key: "uploading", label: "업로드 중" },
  { key: "success", label: "성공" },
  { key: "error", label: "실패" },
];

const QUEUE_STATUS_LABEL: Record<UploadQueueItem["status"], string> = {
  queued: "대기",
  uploading: "업로드 중",
  success: "성공",
  error: "실패",
};

const toDateTimeLocalValue = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => `${value}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const revokeQueuePreviewUrls = (items: UploadQueueItem[]) => {
  for (const item of items) {
    if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
};

type EventChipsInputProps = {
  value: string[];
  onChange: (eventNames: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

const EventChipsInput = ({
  value,
  onChange,
  disabled = false,
  placeholder = "이벤트 입력 후 Enter",
}: EventChipsInputProps) => {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const requestIdRef = useRef(0);

  const selectedEventNames = useMemo(() => {
    return new Set(value.map((name) => normalizeEventLabel(name).toLowerCase()));
  }, [value]);

  const addEventName = useCallback(
    (raw: string) => {
      const normalizedLabel = normalizeEventLabel(raw);

      if (
        !normalizedLabel ||
        normalizedLabel.length > MAX_EVENT_NAME_LENGTH ||
        value.length >= MAX_EVENT_NAME_COUNT
      ) {
        return;
      }

      const merged = sanitizeEventNames([...value, normalizedLabel]);
      if (merged.length === value.length) {
        return;
      }

      onChange(merged);
      setInputValue("");
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [onChange, value],
  );

  const removeEventName = useCallback(
    (target: string) => {
      const normalizedTarget = normalizeEventLabel(target).toLowerCase();
      onChange(
        value.filter(
          (eventName) =>
            normalizeEventLabel(eventName).toLowerCase() !== normalizedTarget,
        ),
      );
    },
    [onChange, value],
  );

  useEffect(() => {
    if (disabled) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    const query = normalizeEventLabel(inputValue);
    if (!query) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/events?query=${encodeURIComponent(query)}&limit=8`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const body = (await response.json()) as AdminEventsApiResult;

        if (!response.ok) {
          throw new Error(body.error?.message ?? "이벤트 자동완성 목록을 불러오지 못했어요.");
        }

        if (requestIdRef.current !== nextRequestId) {
          return;
        }

        const sanitized = sanitizeEventNames(body.items ?? [])
          .filter((item) => !selectedEventNames.has(normalizeEventLabel(item).toLowerCase()))
          .slice(0, MAX_EVENT_NAME_COUNT);
        setSuggestions(sanitized);
        setIsOpen(sanitized.length > 0);
        setActiveIndex(sanitized.length > 0 ? 0 : -1);
      } catch {
        if (requestIdRef.current !== nextRequestId) {
          return;
        }
        setSuggestions([]);
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [disabled, inputValue, selectedEventNames]);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((eventName) => (
          <span
            key={eventName}
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[0.7rem] text-[color:var(--color-ink)]"
          >
            {eventName}
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeEventName(eventName)}
              className="text-[0.7rem] text-[color:var(--color-muted)] disabled:opacity-40"
              aria-label={`${eventName} 삭제`}
            >
              x
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <input
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            if (!isOpen) {
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();

              if (isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
                addEventName(suggestions[activeIndex]);
                return;
              }

              addEventName(inputValue);
              return;
            }

            if (event.key === ",") {
              event.preventDefault();
              addEventName(inputValue);
              return;
            }

            if (event.key === "Backspace" && !inputValue) {
              const last = value[value.length - 1];
              if (last) {
                removeEventName(last);
              }
              return;
            }

            if (event.key === "ArrowDown") {
              if (suggestions.length === 0) {
                return;
              }
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) => (current + 1) % suggestions.length);
              return;
            }

            if (event.key === "ArrowUp") {
              if (suggestions.length === 0) {
                return;
              }
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) =>
                current <= 0 ? suggestions.length - 1 : current - 1,
              );
              return;
            }

            if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
          disabled={disabled || value.length >= MAX_EVENT_NAME_COUNT}
          className="ui-input min-h-10 w-full px-3 text-[0.8rem] disabled:opacity-60"
          placeholder={placeholder}
        />

        {isOpen && suggestions.length > 0 ? (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-[0.8rem] border border-[color:var(--color-line)] bg-white shadow-sm">
            {suggestions.map((suggestion, index) => (
              <li key={`${suggestion}-${index}`}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    addEventName(suggestion);
                  }}
                  className={`block min-h-10 w-full px-3 text-left text-[0.78rem] ${
                    index === activeIndex
                      ? "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-strong)]"
                      : "bg-white text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface)]"
                  }`}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="text-[0.68rem] text-[color:var(--color-muted)]">
        이벤트 {value.length}/{MAX_EVENT_NAME_COUNT} · 최대 {MAX_EVENT_NAME_LENGTH}자
      </p>
    </div>
  );
};

const toPwaBrandingVersionLabel = (version: string) => {
  if (version === "default") {
    return "기본 아이콘";
  }

  const parsed = new Date(version);

  if (Number.isNaN(parsed.getTime())) {
    return version;
  }

  return `최종 반영: ${parsed.toLocaleString("ko-KR")}`;
};

const uploadSingleFile = (
  file: File,
  visibility: "family" | "admin",
  metadata: UploadMetadataPayload,
  onProgress: (progress: number) => void,
): Promise<UploadResult> => {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("files", file);
    formData.append("visibility", visibility);
    formData.append("caption", metadata.caption);
    formData.append("takenAt", metadata.takenAt);
    formData.append("eventNames", JSON.stringify(metadata.eventNames));

    xhr.open("POST", "/api/admin/upload");
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress(event.loaded / event.total);
    };

    xhr.onload = () => {
      const body = (xhr.response ?? {}) as UploadApiResult;
      const uploaded = body.uploaded?.[0];
      const failed = body.failed?.[0];

      if (xhr.status >= 200 && xhr.status < 300 && uploaded) {
        resolve({
          ok: true,
          uploadedPath: uploaded.path,
          uploadedPhotoId: uploaded.id,
          visibility: uploaded.visibility,
        });
        return;
      }

      resolve({
        ok: false,
        errorReason:
          body.error?.message ||
          failed?.reason ||
          "업로드에 실패했어요. 잠시 후 다시 시도해 주세요.",
      });
    };

    xhr.onerror = () => {
      resolve({
        ok: false,
        errorReason: "네트워크 오류가 발생했어요. 연결 상태를 확인해 주세요.",
      });
    };

    xhr.send(formData);
  });
};

export function AdminConsole() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [queueCompactMode, setQueueCompactMode] = useState(false);
  const [expandedQueueItemIds, setExpandedQueueItemIds] = useState<string[]>([]);
  const [visibleQueueCount, setVisibleQueueCount] = useState(QUEUE_RENDER_STEP);
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState("업로드할 사진을 선택해 주세요.");
  const [uploadVisibility, setUploadVisibility] = useState<"family" | "admin">("family");
  const [bulkTakenAtInput, setBulkTakenAtInput] = useState("");
  const [bulkEventNames, setBulkEventNames] = useState<string[]>([]);
  const [togglingPhotoId, setTogglingPhotoId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<AdminPhotoItem[]>([]);
  const [nextPhotoCursor, setNextPhotoCursor] = useState<string | null>(null);
  const [isPhotosLoading, setIsPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState("");
  const [editingTakenAt, setEditingTakenAt] = useState("");
  const [editingEventNames, setEditingEventNames] = useState<string[]>([]);
  const [savingPhotoId, setSavingPhotoId] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [pwaBranding, setPwaBranding] = useState<PwaBrandingState | null>(null);
  const [isPwaBrandingLoading, setIsPwaBrandingLoading] = useState(false);
  const [isPwaLogoUploading, setIsPwaLogoUploading] = useState(false);
  const [isPwaLogoResetting, setIsPwaLogoResetting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pwaLogoInputRef = useRef<HTMLInputElement | null>(null);
  const photosLoadingRef = useRef(false);
  const queueRef = useRef<UploadQueueItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const response = await fetch("/api/admin/session", {
          method: "GET",
          cache: "no-store",
        });
        const body = (await response.json()) as { authenticated?: boolean };

        if (!mounted) {
          return;
        }

        setAuthenticated(Boolean(body.authenticated));
      } catch {
        if (!mounted) {
          return;
        }

        setAuthenticated(false);
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    };

    void loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => getQueueSummary(queue), [queue]);
  const queueStatusCounts = useMemo(
    () => ({
      all: queue.length,
      queued: queue.filter((item) => item.status === "queued").length,
      uploading: queue.filter((item) => item.status === "uploading").length,
      success: queue.filter((item) => item.status === "success").length,
      error: queue.filter((item) => item.status === "error").length,
    }),
    [queue],
  );
  const filteredQueue = useMemo(
    () => (queueFilter === "all" ? queue : queue.filter((item) => item.status === queueFilter)),
    [queue, queueFilter],
  );
  const visibleQueue = useMemo(
    () => filteredQueue.slice(0, visibleQueueCount),
    [filteredQueue, visibleQueueCount],
  );
  const hiddenFilteredQueueCount = Math.max(0, filteredQueue.length - visibleQueue.length);
  const queuedItems = useMemo(
    () => queue.filter((item) => item.status === "queued"),
    [queue],
  );
  const failedItems = useMemo(() => pickRetryTargets(queue), [queue]);
  const pwaPreviewSrc = useMemo(() => {
    if (!pwaBranding) {
      return "/pwa/icon/192.png";
    }

    if (pwaBranding.version === "default") {
      return "/pwa/icon/192.png";
    }

    return `/pwa/icon/192.png?v=${encodeURIComponent(pwaBranding.version)}`;
  }, [pwaBranding]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    setExpandedQueueItemIds((current) =>
      current.filter((itemId) => queue.some((item) => item.id === itemId)),
    );

    if (queue.length === 0) {
      setQueueFilter("all");
      setQueueCompactMode(false);
      return;
    }

    if (queue.length >= LARGE_QUEUE_COMPACT_THRESHOLD && !queueCompactMode) {
      setQueueCompactMode(true);
    }
  }, [queue, queueCompactMode]);

  useEffect(() => {
    setVisibleQueueCount(QUEUE_RENDER_STEP);
  }, [queueFilter]);

  useEffect(() => {
    setVisibleQueueCount((current) => {
      if (filteredQueue.length === 0) {
        return QUEUE_RENDER_STEP;
      }

      return Math.min(Math.max(current, QUEUE_RENDER_STEP), filteredQueue.length);
    });
  }, [filteredQueue.length]);

  useEffect(() => {
    return () => {
      revokeQueuePreviewUrls(queueRef.current);
    };
  }, []);

  const loadPhotos = useCallback(
    async ({
      append,
      cursor,
    }: {
      append: boolean;
      cursor?: string | null;
    }) => {
      if (!authenticated) {
        return;
      }

      if (photosLoadingRef.current) {
        return;
      }

      photosLoadingRef.current = true;
      setIsPhotosLoading(true);
      setPhotosError(null);

      try {
        const params = new URLSearchParams({
          limit: `${PAGE_LIMIT}`,
        });

        if (append && cursor) {
          params.set("cursor", cursor);
        }

        const response = await fetch(`/api/admin/photos?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        const body = (await response.json()) as AdminPhotosApiResult;

        if (!response.ok) {
          throw new Error(body.error?.message ?? "기존 사진 목록을 불러오지 못했어요.");
        }

        const fetched = (body.items ?? []).map((item) => ({
          ...item,
          eventNames: Array.isArray(item.eventNames) ? item.eventNames : [],
        }));
        const nextCursor = body.nextCursor ?? null;

        setPhotos((current) => {
          if (!append) {
            return fetched;
          }

          return Array.from(new Map([...current, ...fetched].map((item) => [item.id, item])).values());
        });
        setNextPhotoCursor(nextCursor);
      } catch (error) {
        setPhotosError(
          error instanceof Error
            ? error.message
            : "기존 사진 목록을 불러오지 못했어요.",
        );
      } finally {
        photosLoadingRef.current = false;
        setIsPhotosLoading(false);
      }
    },
    [authenticated],
  );

  useEffect(() => {
    if (!authenticated || !ready) {
      return;
    }

    void loadPhotos({ append: false });
  }, [authenticated, loadPhotos, ready]);

  const loadPwaBranding = useCallback(async () => {
    if (!authenticated) {
      return;
    }

    setIsPwaBrandingLoading(true);

    try {
      const response = await fetch("/api/admin/pwa-branding", {
        method: "GET",
        cache: "no-store",
      });
      const body = (await response.json()) as AdminPwaBrandingApiResult;

      if (!response.ok || !body.branding) {
        throw new Error(body.error?.message ?? "앱 아이콘 설정을 불러오지 못했어요.");
      }

      setPwaBranding(body.branding);
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "앱 아이콘 설정을 불러오지 못했어요.",
      );
    } finally {
      setIsPwaBrandingLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || !ready) {
      return;
    }

    void loadPwaBranding();
  }, [authenticated, loadPwaBranding, ready]);

  const hydrateQueuedItemMetadata = useCallback(async (items: UploadQueueItem[]) => {
    for (const item of items) {
      try {
        const metadata = await extractPhotoUploadMetadata(item.file);
        setQueue((current) =>
          current.map((entry) => {
            if (entry.id !== item.id) {
              return entry;
            }

            return {
              ...entry,
              caption: entry.captionTouched ? entry.caption : metadata.caption,
              takenAtInput: entry.takenAtTouched
                ? entry.takenAtInput
                : toDateTimeLocalInputValue(metadata.takenAt),
              locationLabel: metadata.locationLabel ?? null,
              metadataLoading: false,
            };
          }),
        );
      } catch {
        setQueue((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  metadataLoading: false,
                }
              : entry,
          ),
        );
      }
    }
  }, []);

  const updateQueueCaption = (itemId: string, caption: string) => {
    setQueue((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              caption,
              captionTouched: true,
            }
          : item,
      ),
    );
  };

  const updateQueueTakenAtInput = (itemId: string, takenAtInput: string) => {
    setQueue((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              takenAtInput,
              takenAtTouched: true,
            }
          : item,
      ),
    );
  };

  const updateQueueEventNames = (itemId: string, eventNames: string[]) => {
    setQueue((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              eventNames: sanitizeEventNames(eventNames),
            }
          : item,
      ),
    );
  };

  const removeQueueItem = (itemId: string) => {
    setQueue((current) => {
      const target = current.find((item) => item.id === itemId);
      if (target?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== itemId);
    });
    setExpandedQueueItemIds((current) => current.filter((id) => id !== itemId));
  };

  const toggleQueueItemExpanded = (itemId: string) => {
    setExpandedQueueItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  };

  const expandAllFilteredQueueItems = () => {
    setExpandedQueueItemIds((current) => {
      const merged = new Set(current);

      for (const item of filteredQueue) {
        merged.add(item.id);
      }

      return Array.from(merged);
    });
  };

  const collapseAllFilteredQueueItems = () => {
    const hiddenSet = new Set(filteredQueue.map((item) => item.id));

    setExpandedQueueItemIds((current) => current.filter((id) => !hiddenSet.has(id)));
  };

  const applyBulkMetadataToQueue = () => {
    const targetCount = queue.filter(
      (item) => item.status === "queued" || item.status === "error",
    ).length;

    if (targetCount === 0) {
      setStatusText("일괄 적용 대상(대기/실패)이 없어요.");
      return;
    }

    if (!bulkTakenAtInput && bulkEventNames.length === 0) {
      setStatusText("일괄 촬영일 또는 일괄 이벤트를 입력해 주세요.");
      return;
    }

    if (bulkTakenAtInput) {
      const date = new Date(bulkTakenAtInput);
      if (Number.isNaN(date.getTime())) {
        setStatusText("일괄 촬영일 형식이 올바르지 않아요.");
        return;
      }
    }

    setQueue((current) =>
      current.map((item) => {
        if (item.status !== "queued" && item.status !== "error") {
          return item;
        }

        return {
          ...item,
          takenAtInput: bulkTakenAtInput || item.takenAtInput,
          takenAtTouched: bulkTakenAtInput ? true : item.takenAtTouched,
          eventNames: bulkEventNames.length > 0 ? bulkEventNames : item.eventNames,
        };
      }),
    );
    setStatusText(`일괄 메타데이터를 ${targetCount}개 항목에 적용했어요.`);
  };

  const runUpload = async (targets: UploadQueueItem[]) => {
    if (targets.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);
    setStatusText(`${targets.length}개 파일 업로드를 시작합니다.`);

    let successCount = 0;
    let failureCount = 0;

    for (const item of targets) {
      const itemVisibility = item.visibility ?? uploadVisibility;
      const caption = item.caption.trim();
      const takenAtDate = new Date(item.takenAtInput);
      const hasInvalidEventName = item.eventNames.some((eventName) => {
        const normalized = normalizeEventLabel(eventName);
        return !normalized || normalized.length > MAX_EVENT_NAME_LENGTH;
      });
      const eventNames = sanitizeEventNames(item.eventNames);

      if (!caption) {
        failureCount += 1;
        setQueue((current) =>
          markUploadError(current, item.id, "캡션을 입력해 주세요."),
        );
        continue;
      }

      if (caption.length > MAX_CAPTION_LENGTH) {
        failureCount += 1;
        setQueue((current) =>
          markUploadError(
            current,
            item.id,
            `캡션은 ${MAX_CAPTION_LENGTH}자 이하여야 해요.`,
          ),
        );
        continue;
      }

      if (Number.isNaN(takenAtDate.getTime())) {
        failureCount += 1;
        setQueue((current) =>
          markUploadError(current, item.id, "촬영일 형식이 올바르지 않아요."),
        );
        continue;
      }

      if (item.eventNames.length > MAX_EVENT_NAME_COUNT || hasInvalidEventName) {
        failureCount += 1;
        setQueue((current) =>
          markUploadError(
            current,
            item.id,
            `이벤트는 최대 ${MAX_EVENT_NAME_COUNT}개, 각 ${MAX_EVENT_NAME_LENGTH}자까지 입력할 수 있어요.`,
          ),
        );
        continue;
      }

      setQueue((current) => setUploadProgress(current, item.id, 0, "uploading"));

      const result = await uploadSingleFile(
        item.file,
        itemVisibility,
        {
          caption,
          takenAt: takenAtDate.toISOString(),
          eventNames,
        },
        (progress) => {
          setQueue((current) =>
            setUploadProgress(current, item.id, progress, "uploading"),
          );
        },
      );

      if (result.ok && result.uploadedPath) {
        const uploadedPath = result.uploadedPath;

        successCount += 1;
        setQueue((current) =>
          markUploadSuccess(current, item.id, uploadedPath, {
            uploadedPhotoId: result.uploadedPhotoId,
            visibility: result.visibility ?? itemVisibility,
          }),
        );
        continue;
      }

      failureCount += 1;
      setQueue((current) =>
        markUploadError(
          current,
          item.id,
          result.errorReason ?? "업로드에 실패했어요.",
        ),
      );
    }

    setIsUploading(false);
    setStatusText(
      `업로드 완료: 성공 ${successCount}개 · 실패 ${failureCount}개`,
    );

    if (successCount > 0) {
      void loadPhotos({ append: false });
    }
  };

  const handleQueueFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const items = createUploadQueue(Array.from(files), uploadVisibility).map((item) => ({
      ...item,
      previewUrl: URL.createObjectURL(item.file),
    }));
    setQueue((current) => [...current, ...items]);
    setStatusText(`${items.length}개 파일을 대기열에 추가했고 메타데이터를 읽는 중이에요.`);
    void hydrateQueuedItemMetadata(items);
  };

  const handleRetryFailed = async () => {
    if (failedItems.length === 0 || isUploading) {
      return;
    }

    setQueue((current) =>
      current.map((item) =>
        item.status === "error"
          ? {
              ...item,
              status: "queued",
              progress: 0,
              errorReason: undefined,
            }
          : item,
      ),
    );
    await runUpload(failedItems);
  };

  const handleUploadPwaLogo = async (file: File) => {
    if (isPwaLogoUploading || isPwaLogoResetting) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatusText("앱 아이콘은 이미지 파일만 업로드할 수 있어요.");
      return;
    }

    if (file.size > MAX_PWA_LOGO_SIZE_BYTES) {
      setStatusText("앱 아이콘 파일 크기는 10MB 이하여야 해요.");
      return;
    }

    setIsPwaLogoUploading(true);
    setStatusText("앱 아이콘을 자동 생성하고 업로드하고 있어요.");

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const response = await fetch("/api/admin/pwa-branding", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as AdminPwaBrandingApiResult;

      if (!response.ok || !body.branding) {
        throw new Error(body.error?.message ?? "앱 아이콘 저장에 실패했어요.");
      }

      setPwaBranding(body.branding);
      setStatusText("앱 아이콘을 업데이트했어요. 새로 설치/새로고침 시 반영돼요.");
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "앱 아이콘 저장에 실패했어요.",
      );
    } finally {
      setIsPwaLogoUploading(false);

      if (pwaLogoInputRef.current) {
        pwaLogoInputRef.current.value = "";
      }
    }
  };

  const handleResetPwaLogo = async () => {
    if (isPwaLogoUploading || isPwaLogoResetting) {
      return;
    }

    if (!window.confirm("커스텀 앱 아이콘을 지우고 기본 아이콘으로 되돌릴까요?")) {
      return;
    }

    setIsPwaLogoResetting(true);
    setStatusText("앱 아이콘을 기본값으로 되돌리는 중이에요.");

    try {
      const response = await fetch("/api/admin/pwa-branding", {
        method: "DELETE",
      });
      const body = (await response.json()) as AdminPwaBrandingApiResult;

      if (!response.ok || !body.branding) {
        throw new Error(body.error?.message ?? "앱 아이콘 초기화에 실패했어요.");
      }

      setPwaBranding(body.branding);
      setStatusText("기본 앱 아이콘으로 복원했어요.");
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "앱 아이콘 초기화에 실패했어요.",
      );
    } finally {
      setIsPwaLogoResetting(false);
    }
  };

  const handleToggleFeatured = async (item: UploadQueueItem) => {
    if (!item.uploadedPhotoId || togglingPhotoId || isUploading) {
      return;
    }

    const previous = Boolean(item.isFeatured);
    const next = !previous;

    setTogglingPhotoId(item.uploadedPhotoId);
    setQueue((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              isFeatured: next,
            }
          : entry,
      ),
    );

    try {
      const response = await fetch(`/api/admin/photos/${item.uploadedPhotoId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isFeatured: next,
          featuredRank: next ? 1 : null,
        }),
      });
      const data = (await response.json()) as {
        item?: { isFeatured?: boolean };
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(data.error?.message || "대표컷 저장에 실패했어요.");
      }

      setQueue((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                isFeatured: Boolean(data.item?.isFeatured),
              }
            : entry,
        ),
      );
      setPhotos((current) =>
        current.map((entry) =>
          entry.id === item.uploadedPhotoId
            ? {
                ...entry,
                isFeatured: Boolean(data.item?.isFeatured),
              }
            : entry,
        ),
      );

      setStatusText(next ? "대표컷으로 지정했어요." : "대표컷 지정을 해제했어요.");
    } catch (error) {
      setQueue((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                isFeatured: previous,
              }
            : entry,
        ),
      );
      setStatusText(
        error instanceof Error
          ? error.message
          : "대표컷 설정 중 오류가 발생했어요.",
      );
    } finally {
      setTogglingPhotoId(null);
    }
  };

  const handleStartEditPhoto = (item: AdminPhotoItem) => {
    setEditingPhotoId(item.id);
    setEditingCaption(item.caption);
    setEditingTakenAt(toDateTimeLocalValue(item.takenAt));
    setEditingEventNames(item.eventNames ?? []);
  };

  const handleCancelEditPhoto = () => {
    setEditingPhotoId(null);
    setEditingCaption("");
    setEditingTakenAt("");
    setEditingEventNames([]);
  };

  const handleSavePhotoEdit = async (photoId: string) => {
    if (savingPhotoId || deletingPhotoId) {
      return;
    }

    const trimmedCaption = editingCaption.trim();
    if (!trimmedCaption) {
      setStatusText("캡션은 비워둘 수 없어요.");
      return;
    }

    if (!editingTakenAt) {
      setStatusText("촬영일을 입력해 주세요.");
      return;
    }

    const takenAt = new Date(editingTakenAt);
    if (Number.isNaN(takenAt.getTime())) {
      setStatusText("촬영일 형식이 올바르지 않아요.");
      return;
    }

    const invalidEventName = editingEventNames.some((eventName) => {
      const normalized = normalizeEventLabel(eventName);
      return !normalized || normalized.length > MAX_EVENT_NAME_LENGTH;
    });

    if (editingEventNames.length > MAX_EVENT_NAME_COUNT || invalidEventName) {
      setStatusText(
        `이벤트는 최대 ${MAX_EVENT_NAME_COUNT}개, 각 ${MAX_EVENT_NAME_LENGTH}자까지 입력할 수 있어요.`,
      );
      return;
    }

    const sanitizedEditingEventNames = sanitizeEventNames(editingEventNames);

    setSavingPhotoId(photoId);

    try {
      const response = await fetch(`/api/admin/photos/${photoId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caption: trimmedCaption,
          takenAt: takenAt.toISOString(),
          eventNames: sanitizedEditingEventNames,
        }),
      });
      const body = (await response.json()) as {
        item?: AdminPhotoItem;
        error?: { message?: string };
      };

      if (!response.ok || !body.item) {
        throw new Error(body.error?.message || "사진 정보를 저장하지 못했어요.");
      }

      const savedItem: AdminPhotoItem = {
        ...body.item,
        eventNames: Array.isArray(body.item.eventNames) ? body.item.eventNames : [],
      };

      setPhotos((current) =>
        current.map((item) => (item.id === photoId ? savedItem : item)),
      );
      handleCancelEditPhoto();
      setStatusText("사진 정보를 저장했어요.");
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "사진 정보를 저장하지 못했어요.",
      );
    } finally {
      setSavingPhotoId(null);
    }
  };

  const handleDeletePhoto = async (item: AdminPhotoItem) => {
    if (savingPhotoId || deletingPhotoId) {
      return;
    }

    if (!window.confirm(`"${item.caption}" 사진을 삭제할까요? 이 작업은 되돌릴 수 없어요.`)) {
      return;
    }

    setDeletingPhotoId(item.id);

    try {
      const response = await fetch(`/api/admin/photos/${item.id}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        deletedPhotoId?: string;
        warning?: string;
        error?: { message?: string };
      };

      if (!response.ok || !body.ok || !body.deletedPhotoId) {
        throw new Error(body.error?.message || "사진 삭제에 실패했어요.");
      }

      setPhotos((current) => current.filter((entry) => entry.id !== body.deletedPhotoId));
      setQueue((current) => {
        const removed = current.filter((entry) => entry.uploadedPhotoId === body.deletedPhotoId);
        revokeQueuePreviewUrls(removed);
        return current.filter((entry) => entry.uploadedPhotoId !== body.deletedPhotoId);
      });
      setStatusText(body.warning ?? "사진을 삭제했어요.");
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "사진 삭제 중 오류가 발생했어요.",
      );
    } finally {
      setDeletingPhotoId(null);
    }
  };

  if (!ready) {
    return <p className="text-base text-[color:var(--color-muted)]">관리자 세션 확인 중…</p>;
  }

  if (!authenticated) {
    return (
      <section className="ui-surface mx-auto w-full max-w-xl space-y-5 rounded-[var(--radius-lg)] p-5 sm:p-6">
        <h1 className="text-[1.42rem] font-bold tracking-[-0.016em] text-[color:var(--color-ink)]">
          관리자 업로드
        </h1>
        <p className="text-[0.92rem] leading-[1.6] text-[color:var(--color-muted)]">
          사진 업로드는 관리자 계정으로만 가능합니다.
        </p>

        <form
          className="ui-subtle-surface space-y-4 rounded-[var(--radius-md)] p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setAuthLoading(true);
            setStatusText("관리자 인증을 확인하고 있어요.");

            try {
              const response = await fetch("/api/admin/auth", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ password }),
              });
              const body = (await response.json()) as { error?: string };

              if (!response.ok) {
                throw new Error(body.error || "로그인에 실패했어요.");
              }

              setAuthenticated(true);
              setPassword("");
              setStatusText("로그인되었습니다.");
            } catch (error) {
              setStatusText(
                error instanceof Error
                  ? error.message
                  : "로그인에 실패했습니다. 다시 시도해 주세요.",
              );
            } finally {
              setAuthLoading(false);
            }
          }}
        >
          <div className="space-y-2">
            <label
              htmlFor="admin-password"
              className="text-[0.86rem] font-semibold text-[color:var(--color-muted)]"
            >
              관리자 비밀번호
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="ui-input min-h-11 w-full px-3 text-[0.95rem]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="ui-btn ui-btn-primary px-5"
          >
            {authLoading ? "인증 중…" : "로그인"}
          </button>
        </form>

        <output className="rounded-[0.95rem] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.85rem] text-[color:var(--color-muted)]">
          {statusText}
        </output>
      </section>
    );
  }

  return (
    <section className="ui-surface mx-auto w-full max-w-3xl space-y-5 rounded-[var(--radius-lg)] p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.4rem] font-bold tracking-[-0.016em] text-[color:var(--color-ink)]">
            관리자 업로드
          </h1>
          <p className="mt-1 text-[0.9rem] leading-[1.56] text-[color:var(--color-muted)]">
            파일별 진행률과 부분 실패를 확인하고 재시도할 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            setAuthenticated(false);
            revokeQueuePreviewUrls(queueRef.current);
            setQueue([]);
            setPhotos([]);
            setNextPhotoCursor(null);
            setEditingPhotoId(null);
            setEditingCaption("");
            setEditingTakenAt("");
            setEditingEventNames([]);
            setBulkTakenAtInput("");
            setBulkEventNames([]);
            setPwaBranding(null);
            setIsPwaBrandingLoading(false);
            setIsPwaLogoUploading(false);
            setIsPwaLogoResetting(false);
            setStatusText("로그아웃되었습니다.");
          }}
          className="ui-btn ui-btn-secondary px-4"
        >
          로그아웃
        </button>
      </header>

      <output className="sr-only" aria-live="polite">
        {statusText}
      </output>

      <section className="ui-subtle-surface space-y-4 rounded-[var(--radius-md)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.88rem] font-semibold text-[color:var(--color-ink)]">업로드 범위</p>
          <div className="flex items-center gap-2">
            <label
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[0.76rem] font-semibold ${
                uploadVisibility === "family"
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-strong)]"
                  : "border-[color:var(--color-line)] bg-white/90 text-[color:var(--color-muted)]"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value="family"
                checked={uploadVisibility === "family"}
                onChange={() => setUploadVisibility("family")}
              />
              가족 전용
            </label>
            <label
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[0.76rem] font-semibold ${
                uploadVisibility === "admin"
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-strong)]"
                  : "border-[color:var(--color-line)] bg-white/90 text-[color:var(--color-muted)]"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value="admin"
                checked={uploadVisibility === "admin"}
                onChange={() => setUploadVisibility("admin")}
              />
              관리자 전용
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            id="admin-upload"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => handleQueueFiles(event.target.files)}
            className="ui-input min-h-11 flex-1 p-2 text-[0.86rem] text-[color:var(--color-muted)]"
          />
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
              revokeQueuePreviewUrls(queueRef.current);
              setQueue([]);
              setStatusText("업로드 대기열을 비웠어요.");
            }}
            className="ui-btn ui-btn-secondary px-3.5"
          >
            초기화
          </button>
        </div>

        <div className="space-y-2 rounded-[0.95rem] border border-[color:var(--color-line)] bg-white p-3">
          <p className="text-[0.8rem] font-semibold text-[color:var(--color-ink)]">
            대기/실패 항목 일괄 적용
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[0.72rem] font-semibold text-[color:var(--color-muted)]">
                일괄 촬영일
              </span>
              <input
                type="datetime-local"
                value={bulkTakenAtInput}
                onChange={(event) => setBulkTakenAtInput(event.target.value)}
                disabled={isUploading}
                className="ui-input min-h-10 w-full px-3 text-[0.78rem] disabled:opacity-60"
              />
            </label>
            <div className="space-y-1">
              <span className="text-[0.72rem] font-semibold text-[color:var(--color-muted)]">
                일괄 이벤트
              </span>
              <EventChipsInput
                value={bulkEventNames}
                onChange={setBulkEventNames}
                disabled={isUploading}
                placeholder="일괄 이벤트 추가"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={applyBulkMetadataToQueue}
            disabled={isUploading || queue.length === 0}
            className="ui-btn ui-btn-secondary px-3.5 text-[0.76rem] disabled:opacity-60"
          >
            일괄 적용
          </button>
        </div>

        <div className="space-y-2 rounded-[0.95rem] border border-[color:var(--color-line)] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8rem] font-semibold text-[color:var(--color-muted)]">
            <span>전체 진행률</span>
            <span>{Math.round(summary.totalProgress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-brand-soft)]">
            <div
              className="h-full rounded-full bg-[color:var(--color-brand)] transition-all"
              style={{ width: `${Math.round(summary.totalProgress * 100)}%` }}
            />
          </div>
          <p className="text-[0.76rem] leading-[1.45] text-[color:var(--color-muted)]">
            성공 {summary.successCount}개 · 실패 {summary.failureCount}개 · 업로드 중{" "}
            {summary.uploadingCount}개
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void runUpload(queuedItems)}
            disabled={isUploading || queuedItems.length === 0}
            className="ui-btn ui-btn-primary px-4 disabled:opacity-60"
          >
            {isUploading ? "업로드 중…" : `대기 파일 업로드 (${queuedItems.length})`}
          </button>
          <button
            type="button"
            onClick={() => void handleRetryFailed()}
            disabled={isUploading || failedItems.length === 0}
            className="ui-btn ui-btn-secondary px-4 disabled:opacity-60"
          >
            실패 항목 재시도 ({failedItems.length})
          </button>
        </div>
      </section>

      <output className="rounded-[0.95rem] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2 text-[0.84rem] text-[color:var(--color-muted)]">
        {statusText}
      </output>

      <section className="ui-subtle-surface space-y-4 rounded-[var(--radius-md)] p-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[0.94rem] font-semibold text-[color:var(--color-ink)]">
              PWA 앱 아이콘
            </h2>
            <p className="mt-1 text-[0.76rem] leading-[1.45] text-[color:var(--color-muted)]">
              로고 1장을 업로드하면 192/512/apple/maskable 아이콘을 자동 생성해요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadPwaBranding()}
            disabled={isPwaBrandingLoading || isPwaLogoUploading || isPwaLogoResetting}
            className="ui-btn ui-btn-secondary px-3 text-[0.76rem] disabled:opacity-60"
          >
            {isPwaBrandingLoading ? "불러오는 중…" : "설정 새로고침"}
          </button>
        </header>

        <div className="flex items-center gap-3 rounded-[0.95rem] border border-[color:var(--color-line)] bg-white p-3">
          <Image
            key={pwaPreviewSrc}
            src={pwaPreviewSrc}
            alt="PWA 앱 아이콘 미리보기"
            width={72}
            height={72}
            className="h-[4.5rem] w-[4.5rem] rounded-[0.95rem] object-cover ring-1 ring-[color:var(--color-line)]"
            unoptimized
          />
          <div className="min-w-0">
            <p className="text-[0.85rem] font-semibold text-[color:var(--color-ink)]">
              {pwaBranding?.isCustom ? "커스텀 아이콘 사용 중" : "기본 아이콘 사용 중"}
            </p>
            <p className="mt-1 text-[0.74rem] leading-[1.45] text-[color:var(--color-muted)]">
              {toPwaBrandingVersionLabel(pwaBranding?.version ?? "default")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={pwaLogoInputRef}
            type="file"
            accept="image/*"
            disabled={isPwaLogoUploading || isPwaLogoResetting}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (!file) {
                return;
              }

              void handleUploadPwaLogo(file);
            }}
            className="ui-input min-h-11 flex-1 p-2 text-[0.82rem] text-[color:var(--color-muted)] disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void handleResetPwaLogo()}
            disabled={
              isPwaLogoUploading ||
              isPwaLogoResetting ||
              !pwaBranding ||
              !pwaBranding.isCustom
            }
            className="ui-btn ui-btn-secondary px-3.5 text-[0.76rem] disabled:opacity-60"
          >
            {isPwaLogoResetting ? "초기화 중…" : "기본 아이콘 복원"}
          </button>
        </div>
      </section>

      {queue.length > 0 ? (
        <section className="space-y-2.5">
          <div className="rounded-[0.95rem] border border-[color:var(--color-line)] bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {QUEUE_FILTERS.map((filter) => {
                  const active = queueFilter === filter.key;
                  const count = queueStatusCounts[filter.key];

                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setQueueFilter(filter.key)}
                      className={`rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold ${
                        active
                          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-strong)]"
                          : "border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-muted)]"
                      }`}
                    >
                      {filter.label} {count}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQueueCompactMode((current) => !current)}
                  className="ui-btn ui-btn-secondary px-3 text-[0.72rem]"
                >
                  {queueCompactMode ? "컴팩트 해제" : "컴팩트"}
                </button>
                <button
                  type="button"
                  onClick={expandAllFilteredQueueItems}
                  className="ui-btn ui-btn-secondary px-3 text-[0.72rem]"
                >
                  모두 펼치기
                </button>
                <button
                  type="button"
                  onClick={collapseAllFilteredQueueItems}
                  className="ui-btn ui-btn-secondary px-3 text-[0.72rem]"
                >
                  모두 접기
                </button>
              </div>
            </div>
          </div>

          {filteredQueue.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 py-3 text-[0.84rem] text-[color:var(--color-muted)]">
              현재 필터에 해당하는 항목이 없어요.
            </p>
          ) : null}

          <ul className="space-y-2.5">
            {visibleQueue.map((item) => {
            const metadataEditDisabled =
              isUploading || item.status === "uploading" || item.status === "success";
            const canRemoveQueueItem =
              (item.status === "queued" || item.status === "error") && !isUploading;
            const isExpanded = expandedQueueItemIds.includes(item.id);
            const showMetadataEditor =
              !queueCompactMode || isExpanded || item.status === "error";

            return (
              <li
                key={item.id}
                className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white p-3.5"
              >
                <div className="mb-2 flex items-start gap-3">
                  {item.previewUrl ? (
                    <Image
                      src={item.previewUrl}
                      alt={item.file.name}
                      width={84}
                      height={84}
                      className="h-[5.25rem] w-[5.25rem] rounded-[0.9rem] object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="h-[5.25rem] w-[5.25rem] rounded-[0.9rem] bg-[color:var(--color-surface)]" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-[0.9rem] font-semibold text-[color:var(--color-ink)]">
                        {item.file.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[0.7rem] font-semibold text-[color:var(--color-muted)]">
                          {item.visibility === "admin" ? "관리자 전용" : "가족 전용"}
                        </span>
                        <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[0.7rem] font-semibold text-[color:var(--color-muted)]">
                          {QUEUE_STATUS_LABEL[item.status]}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeQueueItem(item.id)}
                          disabled={!canRemoveQueueItem}
                          className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[0.68rem] font-semibold text-rose-700 disabled:opacity-40"
                        >
                          제거
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleQueueItemExpanded(item.id)}
                          className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[0.68rem] font-semibold text-[color:var(--color-muted)]"
                        >
                          {showMetadataEditor ? "접기" : "상세"}
                        </button>
                      </div>
                    </div>

                    {showMetadataEditor ? (
                      <>
                        <input
                          value={item.caption}
                          onChange={(event) => updateQueueCaption(item.id, event.target.value)}
                          maxLength={MAX_CAPTION_LENGTH}
                          disabled={metadataEditDisabled}
                          className="ui-input min-h-10 w-full px-3 text-[0.82rem] disabled:opacity-60"
                          placeholder="캡션"
                        />
                        <input
                          type="datetime-local"
                          value={item.takenAtInput}
                          onChange={(event) => updateQueueTakenAtInput(item.id, event.target.value)}
                          disabled={metadataEditDisabled}
                          className="ui-input min-h-10 w-full px-3 text-[0.79rem] disabled:opacity-60"
                        />
                        <EventChipsInput
                          value={item.eventNames}
                          onChange={(eventNames) => updateQueueEventNames(item.id, eventNames)}
                          disabled={metadataEditDisabled}
                          placeholder="이벤트 입력 후 Enter"
                        />
                        <p className="text-[0.72rem] text-[color:var(--color-muted)]">
                          {item.metadataLoading
                            ? "메타데이터(날짜/위치) 추출 중…"
                            : item.locationLabel
                              ? `위치 추정: ${item.locationLabel}`
                              : "위치정보 없음"}
                        </p>
                      </>
                    ) : (
                      <p className="text-[0.72rem] text-[color:var(--color-muted)]">
                        {item.caption} · {item.takenAtInput.replace("T", " ")} · 이벤트 {item.eventNames.length}개
                      </p>
                    )}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-brand-soft)]">
                  <div
                    className="h-full rounded-full bg-[color:var(--color-brand)] transition-all"
                    style={{ width: `${Math.round(item.progress * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[0.74rem] text-[color:var(--color-muted)]">
                  {Math.round(item.progress * 100)}% · {(item.file.size / (1024 * 1024)).toFixed(2)}MB
                </p>
                {item.uploadedPath ? (
                  <p className="mt-1 text-[0.74rem] text-emerald-700">{item.uploadedPath}</p>
                ) : null}
                {item.errorReason ? (
                  <p className="mt-1 text-[0.74rem] text-rose-700">{item.errorReason}</p>
                ) : null}
                {item.uploadedPhotoId ? (
                  <button
                    type="button"
                    onClick={() => void handleToggleFeatured(item)}
                    disabled={isUploading || togglingPhotoId === item.uploadedPhotoId}
                    className={`ui-btn mt-2 px-3.5 text-[0.76rem] ${
                      item.isFeatured ? "ui-btn-primary" : "ui-btn-secondary"
                    } disabled:opacity-60`}
                  >
                    {togglingPhotoId === item.uploadedPhotoId
                      ? "저장 중…"
                      : item.isFeatured
                        ? "대표컷 해제"
                        : "대표컷으로 지정"}
                  </button>
                ) : null}
              </li>
            );
            })}
          </ul>
          {hiddenFilteredQueueCount > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setVisibleQueueCount((current) =>
                    Math.min(current + QUEUE_RENDER_STEP, filteredQueue.length),
                  );
                }}
                className="ui-btn ui-btn-secondary px-4 text-[0.78rem]"
              >
                더 보기 ({hiddenFilteredQueueCount}개 남음)
              </button>
              <button
                type="button"
                onClick={() => setVisibleQueueCount(filteredQueue.length)}
                className="ui-btn ui-btn-secondary px-4 text-[0.78rem]"
              >
                모두 보기
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 py-3 text-[0.88rem] text-[color:var(--color-muted)]">
          아직 업로드 대기 파일이 없어요.
        </p>
      )}

      <section className="ui-subtle-surface space-y-3 rounded-[var(--radius-md)] p-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[0.94rem] font-semibold text-[color:var(--color-ink)]">
            기존 업로드 사진
          </h2>
          <button
            type="button"
            onClick={() => void loadPhotos({ append: false })}
            disabled={isPhotosLoading}
            className="ui-btn ui-btn-secondary px-3 text-[0.76rem] disabled:opacity-60"
          >
            새로고침
          </button>
        </header>

        {photosError ? (
          <p className="rounded-[0.9rem] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.78rem] text-rose-700">
            {photosError}
          </p>
        ) : null}

        {photos.length > 0 ? (
          <ul className="space-y-2.5">
            {photos.map((item) => {
              const isEditing = editingPhotoId === item.id;
              const isBusy =
                savingPhotoId === item.id || deletingPhotoId === item.id || isPhotosLoading;

              return (
                <li
                  key={item.id}
                  className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white p-3"
                >
                  <div className="flex items-start gap-3">
                    <Image
                      src={item.thumbSrc ?? item.src}
                      alt={item.caption}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-[0.8rem] object-cover"
                      unoptimized
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      {isEditing ? (
                        <>
                          <input
                            value={editingCaption}
                            onChange={(event) => setEditingCaption(event.target.value)}
                            className="ui-input min-h-10 w-full px-3 text-[0.83rem]"
                            placeholder="캡션"
                          />
                          <input
                            type="datetime-local"
                            value={editingTakenAt}
                            onChange={(event) => setEditingTakenAt(event.target.value)}
                            className="ui-input min-h-10 w-full px-3 text-[0.8rem]"
                          />
                          <EventChipsInput
                            value={editingEventNames}
                            onChange={setEditingEventNames}
                            disabled={isBusy}
                            placeholder="이벤트 입력 후 Enter"
                          />
                        </>
                      ) : (
                        <>
                          <p className="truncate text-[0.88rem] font-semibold text-[color:var(--color-ink)]">
                            {item.caption}
                          </p>
                          <p className="text-[0.74rem] text-[color:var(--color-muted)]">
                            촬영일 {new Date(item.takenAt).toLocaleString("ko-KR")}
                          </p>
                          <p className="text-[0.72rem] text-[color:var(--color-muted)]">
                            이벤트{" "}
                            {(item.eventNames.length > 0 ? item.eventNames : ["일상"]).join(", ")}
                          </p>
                        </>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[0.68rem] font-semibold text-[color:var(--color-muted)]">
                          {item.visibility === "admin" ? "관리자 전용" : "가족 전용"}
                        </span>
                        <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[0.68rem] font-semibold text-[color:var(--color-muted)]">
                          {item.isFeatured ? "대표컷" : "일반"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleSavePhotoEdit(item.id)}
                          disabled={isBusy}
                          className="ui-btn ui-btn-primary px-3 text-[0.76rem] disabled:opacity-60"
                        >
                          {savingPhotoId === item.id ? "저장 중…" : "저장"}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditPhoto}
                          disabled={isBusy}
                          className="ui-btn ui-btn-secondary px-3 text-[0.76rem] disabled:opacity-60"
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEditPhoto(item)}
                          disabled={isBusy}
                          className="ui-btn ui-btn-secondary px-3 text-[0.76rem] disabled:opacity-60"
                        >
                          편집
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeletePhoto(item)}
                          disabled={isBusy}
                          className="ui-btn px-3 text-[0.76rem] text-rose-700 ring-1 ring-inset ring-rose-300 hover:bg-rose-50 disabled:opacity-60"
                        >
                          {deletingPhotoId === item.id ? "삭제 중…" : "삭제"}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-[0.9rem] border border-dashed border-[color:var(--color-line)] bg-white px-3 py-2 text-[0.8rem] text-[color:var(--color-muted)]">
            아직 업로드된 사진이 없어요.
          </p>
        )}

        {nextPhotoCursor ? (
          <button
            type="button"
            onClick={() => void loadPhotos({ append: true, cursor: nextPhotoCursor })}
            disabled={isPhotosLoading}
            className="ui-btn ui-btn-secondary w-full px-4 text-[0.8rem] disabled:opacity-60"
          >
            {isPhotosLoading ? "불러오는 중…" : "더 불러오기"}
          </button>
        ) : null}
      </section>
    </section>
  );
}
