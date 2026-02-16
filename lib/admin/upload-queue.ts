import {
  normalizeCaptionFromOriginalName,
  parseTakenAtFromFileName,
} from "@/lib/gallery/upload-metadata";

export type UploadItemStatus = "queued" | "uploading" | "success" | "error";

export type UploadQueueItem = {
  id: string;
  file: File;
  previewUrl?: string;
  caption: string;
  takenAtInput: string;
  eventNames: string[];
  locationLabel?: string | null;
  metadataLoading?: boolean;
  captionTouched?: boolean;
  takenAtTouched?: boolean;
  status: UploadItemStatus;
  progress: number;
  uploadedPath?: string;
  uploadedPhotoId?: string;
  visibility?: "family" | "admin";
  isFeatured?: boolean;
  errorReason?: string;
};

const clampProgress = (value: number) => {
  if (Number.isNaN(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

export const toDateTimeLocalInputValue = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => `${value}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const createUploadQueue = (
  files: File[],
  visibility: "family" | "admin" = "family",
): UploadQueueItem[] => {
  const timestamp = Date.now();
  const toDefaultTakenAt = (file: File) => {
    if (Number.isFinite(file.lastModified) && file.lastModified > 0) {
      return new Date(file.lastModified).toISOString();
    }

    return parseTakenAtFromFileName(file.name) ?? new Date().toISOString();
  };

  return files.map((file, index) => ({
    id: `${timestamp}-${index}-${file.name}-${file.size}`,
    caption: normalizeCaptionFromOriginalName(file.name),
    takenAtInput: toDateTimeLocalInputValue(toDefaultTakenAt(file)),
    eventNames: [],
    locationLabel: null,
    metadataLoading: true,
    captionTouched: false,
    takenAtTouched: false,
    file,
    visibility,
    status: "queued",
    progress: 0,
  }));
};

export const setUploadProgress = (
  queue: UploadQueueItem[],
  itemId: string,
  progress: number,
  status: UploadItemStatus = "uploading",
): UploadQueueItem[] => {
  const normalized = clampProgress(progress);

  return queue.map((item) =>
    item.id === itemId
      ? {
          ...item,
          status,
          progress: normalized,
        }
      : item,
  );
};

export const markUploadSuccess = (
  queue: UploadQueueItem[],
  itemId: string,
  uploadedPath: string,
  options?: {
    uploadedPhotoId?: string;
    visibility?: "family" | "admin";
  },
): UploadQueueItem[] => {
  return queue.map((item) =>
    item.id === itemId
      ? {
          ...item,
          status: "success",
          progress: 1,
          uploadedPath,
          uploadedPhotoId: options?.uploadedPhotoId ?? item.uploadedPhotoId,
          visibility: options?.visibility ?? item.visibility,
          errorReason: undefined,
        }
      : item,
  );
};

export const markUploadError = (
  queue: UploadQueueItem[],
  itemId: string,
  errorReason: string,
): UploadQueueItem[] => {
  return queue.map((item) =>
    item.id === itemId
      ? {
          ...item,
          status: "error",
          errorReason,
        }
      : item,
  );
};

export const pickRetryTargets = (queue: UploadQueueItem[]): UploadQueueItem[] => {
  return queue.filter((item) => item.status === "error");
};

export const getQueueSummary = (queue: UploadQueueItem[]) => {
  const totalCount = queue.length;
  const successCount = queue.filter((item) => item.status === "success").length;
  const failureCount = queue.filter((item) => item.status === "error").length;
  const uploadingCount = queue.filter((item) => item.status === "uploading").length;
  const totalProgress =
    totalCount === 0
      ? 0
      : queue.reduce((sum, item) => sum + clampProgress(item.progress), 0) / totalCount;

  return {
    totalCount,
    successCount,
    failureCount,
    uploadingCount,
    totalProgress,
  };
};
