import { describe, expect, it } from "vitest";

import {
  createUploadQueue,
  getQueueSummary,
  markUploadError,
  markUploadSuccess,
  pickRetryTargets,
  setUploadProgress,
  toDateTimeLocalInputValue,
} from "./upload-queue";

describe("upload queue", () => {
  const files = [
    new File(["a"], "a.jpg", { type: "image/jpeg" }),
    new File(["b"], "b.jpg", { type: "image/jpeg" }),
  ];

  it("creates queued items from files", () => {
    const queue = createUploadQueue(files);

    expect(queue).toHaveLength(2);
    expect(queue[0].status).toBe("queued");
    expect(queue[1].progress).toBe(0);
  });

  it("updates per-file progress and summary", () => {
    const queue = createUploadQueue(files);
    const withProgress = setUploadProgress(queue, queue[0].id, 0.5, "uploading");
    const summary = getQueueSummary(withProgress);

    expect(withProgress[0].progress).toBe(0.5);
    expect(withProgress[0].status).toBe("uploading");
    expect(summary.totalProgress).toBe(0.25);
  });

  it("prefers file lastModified as default takenAt", () => {
    const file = new File(["a"], "IMG_20260214_091122.jpg", {
      type: "image/jpeg",
      lastModified: new Date("2026-02-20T10:30:00.000Z").getTime(),
    });

    const queue = createUploadQueue([file]);

    expect(queue[0]?.takenAtInput).toBe(
      toDateTimeLocalInputValue("2026-02-20T10:30:00.000Z"),
    );
  });

  it("tracks success and failures with retry candidates", () => {
    const queue = createUploadQueue(files);
    const withSuccess = markUploadSuccess(queue, queue[0].id, "/uploads/a.jpg");
    const withFailure = markUploadError(withSuccess, queue[1].id, "업로드 실패");
    const summary = getQueueSummary(withFailure);

    expect(summary.successCount).toBe(1);
    expect(summary.failureCount).toBe(1);
    expect(pickRetryTargets(withFailure).map((item) => item.file.name)).toEqual(["b.jpg"]);
  });
});
