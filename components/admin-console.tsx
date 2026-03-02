"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createUploadQueue,
  markUploadError,
  markUploadSuccess,
  pickRetryTargets,
  setUploadProgress,
  type UploadQueueItem,
} from "@/lib/admin/upload-queue";
import {
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

type AdminPostItem = {
  id: string;
  caption: string;
  takenAt: string;
  visibility: "family" | "admin";
  eventNames: string[];
  photos: AdminPhotoItem[];
};

type AdminPhotosApiResult = {
  items?: AdminPhotoItem[];
  nextCursor?: string | null;
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
const CAPTION_HASHTAG_REGEX = /#([\p{L}\p{N}_-]+)/gu;

const revokeQueuePreviewUrls = (items: UploadQueueItem[]) => {
  for (const item of items) {
    if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
};

const toMinuteBucket = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 16);
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;
};

const toHashtagToken = (value: string) => {
  return normalizeEventLabel(value)
    .replace(/^#+/, "")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .trim();
};

const extractEventNamesFromCaption = (caption: string) => {
  const tokens = Array.from(caption.matchAll(CAPTION_HASHTAG_REGEX))
    .map((match) => toHashtagToken(match[1] ?? ""))
    .filter((value) => value.length > 0);

  return sanitizeEventNames(tokens);
};

const buildPostKey = (item: AdminPhotoItem) => {
  const captionKey = item.caption.trim().toLowerCase();
  const eventKey = sanitizeEventNames(item.eventNames)
    .map((name) => normalizeEventLabel(name).toLowerCase())
    .sort()
    .join("|");

  return `${item.visibility}|${toMinuteBucket(item.takenAt)}|${captionKey}|${eventKey}`;
};

const groupPhotosToPosts = (items: AdminPhotoItem[]): AdminPostItem[] => {
  const byKey = new Map<string, AdminPostItem>();
  const ordered: string[] = [];

  for (const item of items) {
    const key = buildPostKey(item);
    const existing = byKey.get(key);

    if (existing) {
      existing.photos.push(item);
      continue;
    }

    ordered.push(key);
    byKey.set(key, {
      id: key,
      caption: item.caption,
      takenAt: item.takenAt,
      visibility: item.visibility,
      eventNames: item.eventNames,
      photos: [item],
    });
  }

  return ordered
    .map((key) => byKey.get(key))
    .filter((item): item is AdminPostItem => item !== undefined);
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

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTENSION_REGEX = /\.(heic|heif)$/i;

let heic2anyPromise: Promise<typeof import("heic2any").default> | null = null;

const isHeicLikeFile = (file: File) => {
  const type = (file.type || "").toLowerCase();

  if (HEIC_MIME_TYPES.has(type)) {
    return true;
  }

  return HEIC_EXTENSION_REGEX.test(file.name);
};

const buildConvertedFileName = (name: string, extension: string) => {
  const normalizedExt = extension.startsWith(".") ? extension : `.${extension}`;
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const base = withoutExt || "upload";

  return `${base}${normalizedExt}`;
};

const loadHeic2Any = async () => {
  if (!heic2anyPromise) {
    heic2anyPromise = import("heic2any").then((module) => module.default);
  }

  return heic2anyPromise;
};

const pickFirstBlob = (value: Blob | Blob[]) => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
};

const loadImageAsCanvasSource = async (file: File) => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);

      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx: CanvasRenderingContext2D) => {
          ctx.drawImage(bitmap, 0, 0);
        },
        dispose: () => {
          bitmap.close();
        },
      };
    } catch {
      // Fall back to HTMLImageElement decode path.
    }
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("이미지를 디코딩하지 못했어요."));
      element.src = objectUrl;
    });

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (ctx: CanvasRenderingContext2D) => {
        ctx.drawImage(image, 0, 0);
      },
      dispose: () => {
        URL.revokeObjectURL(objectUrl);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) => {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("변환 이미지 생성에 실패했어요."));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
};

const convertImageToOptimizedFile = async (file: File) => {
  const source = await loadImageAsCanvasSource(file);

  try {
    if (source.width <= 0 || source.height <= 0) {
      throw new Error("이미지 크기를 읽지 못했어요.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("브라우저 캔버스를 사용할 수 없어요.");
    }

    source.draw(context);
    const webpBlob = await canvasToBlob(canvas, "image/webp", 0.9);

    if (webpBlob.type === "image/webp") {
      return new File([webpBlob], buildConvertedFileName(file.name, ".webp"), {
        type: "image/webp",
        lastModified: Date.now(),
      });
    }

    const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);

    return new File([jpegBlob], buildConvertedFileName(file.name, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    source.dispose();
  }
};

const convertHeicToOptimizedFile = async (file: File) => {
  const heic2any = await loadHeic2Any();
  const convertedBlobResult = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const convertedBlob = pickFirstBlob(convertedBlobResult);

  if (!convertedBlob) {
    throw new Error("HEIC 변환 결과가 비어 있어요.");
  }

  const jpegBlob =
    convertedBlob.type === "image/jpeg"
      ? convertedBlob
      : new Blob([convertedBlob], { type: "image/jpeg" });

  const jpegFile = new File([jpegBlob], buildConvertedFileName(file.name, ".jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  try {
    return await convertImageToOptimizedFile(jpegFile);
  } catch {
    return jpegFile;
  }
};

const convertFileForPostUpload = async (file: File) => {
  if (!isHeicLikeFile(file)) {
    return file;
  }

  try {
    return await convertHeicToOptimizedFile(file);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `HEIC 변환에 실패했어요: ${error.message}`
        : "HEIC 변환에 실패했어요.",
    );
  }
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
  const [postCaption, setPostCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState("업로드할 사진을 선택해 주세요.");
  const [uploadVisibility, setUploadVisibility] = useState<"family" | "admin">("family");
  const [photos, setPhotos] = useState<AdminPhotoItem[]>([]);
  const [nextPhotoCursor, setNextPhotoCursor] = useState<string | null>(null);
  const [isPhotosLoading, setIsPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [brokenPhotoPreviewIds, setBrokenPhotoPreviewIds] = useState<string[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState("");
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [uploadOverlayState, setUploadOverlayState] = useState<"idle" | "loading" | "success">("idle");
  const [uploadOverlayProgress, setUploadOverlayProgress] = useState(0);
  const [uploadSuccessAnimationSeed, setUploadSuccessAnimationSeed] = useState(0);
  const [pwaBranding, setPwaBranding] = useState<PwaBrandingState | null>(null);
  const [isPwaBrandingLoading, setIsPwaBrandingLoading] = useState(false);
  const [isPwaLogoUploading, setIsPwaLogoUploading] = useState(false);
  const [isPwaLogoResetting, setIsPwaLogoResetting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pwaLogoInputRef = useRef<HTMLInputElement | null>(null);
  const photosLoadingRef = useRef(false);
  const queueRef = useRef<UploadQueueItem[]>([]);
  const uploadOverlayTimerRef = useRef<number | null>(null);

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

  const extractedCaptionEventNames = useMemo(
    () => extractEventNamesFromCaption(postCaption),
    [postCaption],
  );
  const groupedPosts = useMemo(() => groupPhotosToPosts(photos), [photos]);
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

  const clearUploadOverlayTimer = useCallback(() => {
    if (uploadOverlayTimerRef.current === null) {
      return;
    }

    window.clearTimeout(uploadOverlayTimerRef.current);
    uploadOverlayTimerRef.current = null;
  }, []);

  const clearSelectedUploadFiles = useCallback((statusMessage?: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    revokeQueuePreviewUrls(queueRef.current);
    setQueue([]);

    if (statusMessage) {
      setStatusText(statusMessage);
    }
  }, []);

  const showUploadSuccessOverlay = useCallback(() => {
    clearUploadOverlayTimer();
    setUploadSuccessAnimationSeed((current) => current + 1);
    setUploadOverlayProgress(100);
    setUploadOverlayState("success");
    uploadOverlayTimerRef.current = window.setTimeout(() => {
      setUploadOverlayState("idle");
      setUploadOverlayProgress(0);
      uploadOverlayTimerRef.current = null;
    }, 1300);
  }, [clearUploadOverlayTimer]);

  useEffect(() => {
    return () => {
      revokeQueuePreviewUrls(queueRef.current);
      clearUploadOverlayTimer();
    };
  }, [clearUploadOverlayTimer]);

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
    setBrokenPhotoPreviewIds((current) =>
      current.filter((photoId) => photos.some((photo) => photo.id === photoId)),
    );
  }, [photos]);

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
    const first = items[0];

    if (!first) {
      return;
    }

    try {
      const metadata = await extractPhotoUploadMetadata(first.file);
      setPostCaption((current) => (current.trim().length > 0 ? current : metadata.caption));
    } catch {
      // Keep defaults when metadata extraction fails.
    }

    setQueue((current) =>
      current.map((entry) =>
        items.some((item) => item.id === entry.id)
          ? {
              ...entry,
              metadataLoading: false,
            }
          : entry,
      ),
    );
  }, []);

  const runUpload = async (targets: UploadQueueItem[]) => {
    if (targets.length === 0 || isUploading) {
      return;
    }

    const caption = postCaption.trim();
    if (!caption) {
      setStatusText("캡션을 입력해 주세요.");
      return;
    }

    if (caption.length > MAX_CAPTION_LENGTH) {
      setStatusText(`캡션은 ${MAX_CAPTION_LENGTH}자 이하여야 해요.`);
      return;
    }

    const eventNames = extractedCaptionEventNames;
    const takenAtIso = new Date().toISOString();

    clearUploadOverlayTimer();
    setUploadOverlayProgress(0);
    setUploadOverlayState("loading");
    setIsUploading(true);
    setStatusText(`${targets.length}개 파일 업로드를 시작합니다.`);

    let successCount = 0;
    let failureCount = 0;
    let completedCount = 0;
    let activeProgress = 0;

    const updateCountProgress = () => {
      const percent =
        targets.length > 0
          ? Math.min(100, ((completedCount + activeProgress) / targets.length) * 100)
          : 0;
      setUploadOverlayProgress(percent);
    };

    for (const item of targets) {
      const itemVisibility = item.visibility ?? uploadVisibility;
      let uploadFile: File;

      try {
        uploadFile = await convertFileForPostUpload(item.file);
      } catch (conversionError) {
        failureCount += 1;
        completedCount += 1;
        activeProgress = 0;
        updateCountProgress();
        setQueue((current) =>
          markUploadError(
            current,
            item.id,
            conversionError instanceof Error
              ? conversionError.message
              : "업로드용 이미지 변환에 실패했어요.",
          ),
        );
        continue;
      }

      setQueue((current) => setUploadProgress(current, item.id, 0, "uploading"));
      activeProgress = 0;
      updateCountProgress();

      const result = await uploadSingleFile(
        uploadFile,
        itemVisibility,
        {
          caption,
          takenAt: takenAtIso,
          eventNames,
        },
        (progress) => {
          activeProgress = Math.max(0, Math.min(progress, 1));
          updateCountProgress();
          setQueue((current) =>
            setUploadProgress(current, item.id, progress, "uploading"),
          );
        },
      );

      if (result.ok && result.uploadedPath) {
        const uploadedPath = result.uploadedPath;

        successCount += 1;
        completedCount += 1;
        activeProgress = 0;
        updateCountProgress();
        setQueue((current) =>
          markUploadSuccess(current, item.id, uploadedPath, {
            uploadedPhotoId: result.uploadedPhotoId,
            visibility: result.visibility ?? itemVisibility,
          }),
        );
        continue;
      }

      failureCount += 1;
      completedCount += 1;
      activeProgress = 0;
      updateCountProgress();
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

    clearSelectedUploadFiles();

    if (successCount > 0 && failureCount === 0) {
      showUploadSuccessOverlay();
    } else {
      clearUploadOverlayTimer();
      setUploadOverlayState("idle");
      setUploadOverlayProgress(0);
    }

    if (successCount > 0) {
      void loadPhotos({ append: false });
    }

    if (failureCount === 0) {
      setPostCaption("");
    }
  };

  const handleQueueFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const shouldApplyDefaults = queue.length === 0;
    const items = createUploadQueue(Array.from(files), uploadVisibility).map((item) => ({
      ...item,
      previewUrl: URL.createObjectURL(item.file),
    }));
    setQueue((current) => [...current, ...items]);
    if (shouldApplyDefaults) {
      const first = items[0];
      if (first) {
        setPostCaption(first.caption);
      }
    }
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

  const handleStartEditPost = (post: AdminPostItem) => {
    setEditingPostId(post.id);
    setEditingCaption(post.caption);
  };

  const handleCancelEditPost = () => {
    setEditingPostId(null);
    setEditingCaption("");
  };

  const handleSavePostEdit = async (postId: string) => {
    if (savingPostId || deletingPostId) {
      return;
    }

    const targetPost = groupedPosts.find((post) => post.id === postId);
    if (!targetPost) {
      setStatusText("수정할 게시글을 찾지 못했어요.");
      return;
    }

    const trimmedCaption = editingCaption.trim();
    if (!trimmedCaption) {
      setStatusText("캡션은 비워둘 수 없어요.");
      return;
    }

    const eventNames = extractEventNamesFromCaption(trimmedCaption);

    setSavingPostId(postId);

    try {
      const updatedById = new Map<string, AdminPhotoItem>();

      for (const photo of targetPost.photos) {
        const response = await fetch(`/api/admin/photos/${photo.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            caption: trimmedCaption,
            eventNames,
          }),
        });
        const body = (await response.json()) as {
          item?: AdminPhotoItem;
          error?: { message?: string };
        };

        if (!response.ok || !body.item) {
          throw new Error(body.error?.message || "게시글 정보를 저장하지 못했어요.");
        }

        updatedById.set(photo.id, {
          ...body.item,
          eventNames: Array.isArray(body.item.eventNames) ? body.item.eventNames : [],
        });
      }

      setPhotos((current) =>
        current.map((item) => updatedById.get(item.id) ?? item),
      );
      handleCancelEditPost();
      setStatusText(`게시글 사진 ${targetPost.photos.length}장을 저장했어요.`);
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "게시글 정보를 저장하지 못했어요.",
      );
    } finally {
      setSavingPostId(null);
    }
  };

  const handleDeletePost = async (post: AdminPostItem) => {
    if (savingPostId || deletingPostId) {
      return;
    }

    if (
      !window.confirm(
        `"${post.caption}" 게시글(${post.photos.length}장)을 삭제할까요? 이 작업은 되돌릴 수 없어요.`,
      )
    ) {
      return;
    }

    setDeletingPostId(post.id);

    try {
      const deletedIds = new Set<string>();

      for (const photo of post.photos) {
        const response = await fetch(`/api/admin/photos/${photo.id}`, {
          method: "DELETE",
        });
        const body = (await response.json()) as {
          ok?: boolean;
          deletedPhotoId?: string;
          warning?: string;
          error?: { message?: string };
        };

        if (!response.ok || !body.ok || !body.deletedPhotoId) {
          throw new Error(body.error?.message || "게시글 삭제에 실패했어요.");
        }

        deletedIds.add(body.deletedPhotoId);
      }

      setPhotos((current) => current.filter((entry) => !deletedIds.has(entry.id)));
      setQueue((current) => {
        const removed = current.filter(
          (entry) => entry.uploadedPhotoId && deletedIds.has(entry.uploadedPhotoId),
        );
        revokeQueuePreviewUrls(removed);
        return current.filter(
          (entry) => !(entry.uploadedPhotoId && deletedIds.has(entry.uploadedPhotoId)),
        );
      });
      if (editingPostId === post.id) {
        handleCancelEditPost();
      }
      setStatusText(`게시글 사진 ${deletedIds.size}장을 삭제했어요.`);
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "게시글 삭제 중 오류가 발생했어요.",
      );
    } finally {
      setDeletingPostId(null);
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
            게시글 단위(여러 장 + 캡션 + 해시태그)로 업로드하고 재시도할 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            setAuthenticated(false);
            clearSelectedUploadFiles();
            clearUploadOverlayTimer();
            setUploadOverlayState("idle");
            setUploadOverlayProgress(0);
            setPhotos([]);
            setNextPhotoCursor(null);
            setPostCaption("");
            setEditingPostId(null);
            setEditingCaption("");
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

      <section className="ui-subtle-surface relative space-y-4 overflow-hidden rounded-[var(--radius-md)] p-4">
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
            onClick={() => clearSelectedUploadFiles("업로드 대기열을 비웠어요.")}
            className="ui-btn ui-btn-secondary px-3.5"
          >
            초기화
          </button>
        </div>

        <label className="space-y-1">
          <span className="text-[0.78rem] font-semibold text-[color:var(--color-muted)]">
            캡션(해시태그 포함)
          </span>
          <textarea
            value={postCaption}
            onChange={(event) => setPostCaption(event.target.value)}
            maxLength={MAX_CAPTION_LENGTH}
            disabled={isUploading}
            className="ui-input min-h-[6.2rem] w-full resize-y px-3 py-2 text-[0.85rem] leading-[1.45] disabled:opacity-60"
            placeholder='예: 루다 자는 모습 #꿈나라'
          />
          <p className="text-[0.7rem] text-[color:var(--color-muted)]">
            {postCaption.length}/{MAX_CAPTION_LENGTH}
          </p>
          <p className="text-[0.72rem] text-[color:var(--color-muted)]">
            캡션에 입력한 #해시태그가 이벤트로 자동 저장됩니다.
          </p>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void runUpload(queuedItems)}
            disabled={isUploading || queuedItems.length === 0}
            className="ui-btn ui-btn-primary px-4 disabled:opacity-60"
          >
            {isUploading ? "업로드 중…" : `게시글 업로드 (${queuedItems.length}장)`}
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

        {uploadOverlayState !== "idle" ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[var(--radius-md)] bg-black/10">
            {uploadOverlayState === "loading" ? (
              <div className="w-[100px]">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-brand-soft)]">
                  <div
                    className="h-full bg-[color:var(--color-brand)] transition-[width] duration-150 ease-linear"
                    style={{ width: `${uploadOverlayProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-[0.95rem] font-bold text-[color:var(--color-brand-strong)]">
                  {`${Math.max(0, Math.min(uploadOverlayProgress, 100)).toFixed(1)}%`}
                </p>
              </div>
            ) : (
              <div key={uploadSuccessAnimationSeed} className="flex h-[100px] w-[100px] items-center justify-center">
                <svg
                  viewBox="0 0 120 100"
                  className="h-full w-full"
                  fill="none"
                  aria-label="업로드 완료"
                >
                  <path
                    d="M8 53 L37 84 L112 12"
                    pathLength={1}
                    stroke="#22c55e"
                    strokeWidth={12}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="1"
                      to="0"
                      dur="0.62s"
                      fill="freeze"
                    />
                  </path>
                </svg>
              </div>
            )}
          </div>
        ) : null}
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

      <section className="ui-subtle-surface space-y-3 rounded-[var(--radius-md)] p-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[0.94rem] font-semibold text-[color:var(--color-ink)]">
            기존 업로드 게시글
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

        {groupedPosts.length > 0 ? (
          <ul className="space-y-2.5">
            {groupedPosts.map((post) => {
              const isEditing = editingPostId === post.id;
              const isBusy =
                savingPostId === post.id || deletingPostId === post.id || isPhotosLoading;

              return (
                <li
                  key={post.id}
                  className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white p-3"
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {post.photos.slice(0, 6).map((photo, index, array) => {
                      const remaining = post.photos.length - array.length;
                      const shouldShowOverlay = index === array.length - 1 && remaining > 0;

                      return (
                        <div key={photo.id} className="relative overflow-hidden rounded-[0.75rem]">
                          {brokenPhotoPreviewIds.includes(photo.id) ? (
                            <div className="flex aspect-square w-full items-center justify-center bg-[color:var(--color-surface)] text-[0.66rem] text-[color:var(--color-muted)]">
                              이미지
                            </div>
                          ) : (
                            <Image
                              src={photo.thumbSrc ?? photo.src}
                              alt={photo.caption}
                              width={180}
                              height={180}
                              className="aspect-square w-full object-cover"
                              unoptimized
                              onError={() => {
                                setBrokenPhotoPreviewIds((current) =>
                                  current.includes(photo.id) ? current : [...current, photo.id],
                                );
                              }}
                            />
                          )}
                          {shouldShowOverlay ? (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[0.86rem] font-semibold text-white">
                              +{remaining}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 space-y-1">
                    {isEditing ? (
                      <>
                        <input
                          value={editingCaption}
                          onChange={(event) => setEditingCaption(event.target.value)}
                          className="ui-input min-h-10 w-full px-3 text-[0.83rem]"
                          placeholder="캡션"
                        />
                        <p className="text-[0.72rem] text-[color:var(--color-muted)]">
                          저장 시 캡션의 #해시태그가 이벤트로 자동 반영됩니다.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="truncate text-[0.9rem] font-semibold text-[color:var(--color-ink)]">
                          {post.caption}
                        </p>
                      </>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[0.68rem] font-semibold text-[color:var(--color-muted)]">
                        {post.visibility === "admin" ? "관리자 전용" : "가족 전용"}
                      </span>
                      <span className="rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[0.68rem] font-semibold text-[color:var(--color-muted)]">
                        사진 {post.photos.length}장
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleSavePostEdit(post.id)}
                          disabled={isBusy}
                          className="ui-btn ui-btn-primary px-3 text-[0.76rem] disabled:opacity-60"
                        >
                          {savingPostId === post.id ? "저장 중…" : "저장"}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditPost}
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
                          onClick={() => handleStartEditPost(post)}
                          disabled={isBusy}
                          className="ui-btn ui-btn-secondary px-3 text-[0.76rem] disabled:opacity-60"
                        >
                          게시글 편집
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeletePost(post)}
                          disabled={isBusy}
                          className="ui-btn px-3 text-[0.76rem] text-rose-700 ring-1 ring-inset ring-rose-300 hover:bg-rose-50 disabled:opacity-60"
                        >
                          {deletingPostId === post.id ? "삭제 중…" : "게시글 삭제"}
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
            아직 업로드된 게시글이 없어요.
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
