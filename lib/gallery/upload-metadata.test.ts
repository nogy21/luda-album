import { describe, expect, test } from "vitest";

import {
  extractPhotoUploadMetadata,
  normalizeCaptionFromOriginalName,
  parseTakenAtFromFileName,
} from "./upload-metadata";

describe("upload metadata", () => {
  test("normalizeCaptionFromOriginalName strips uuid-like prefix and separators", () => {
    expect(
      normalizeCaptionFromOriginalName(
        "8f41f6f6-9004-4f77-98dd-90aa10af2ea5-IMG_20260214_091122.jpg",
      ),
    ).toBe("20260214 091122");
    expect(normalizeCaptionFromOriginalName("  luda-moment__best-shot .jpeg ")).toBe(
      "luda moment best shot",
    );
  });

  test("parseTakenAtFromFileName parses compact camera pattern", () => {
    expect(parseTakenAtFromFileName("IMG_20260214_091122.jpg")).toBe(
      "2026-02-14T09:11:22.000Z",
    );
  });

  test("parseTakenAtFromFileName parses date-only pattern", () => {
    expect(parseTakenAtFromFileName("2026-02-14-luda.jpg")).toBe(
      "2026-02-14T00:00:00.000Z",
    );
  });

  test("extractPhotoUploadMetadata prioritizes file.lastModified over EXIF", async () => {
    const file = new File(["abc"], "IMG_20260214_091122.jpg", {
      type: "image/jpeg",
      lastModified: new Date("2026-02-15T06:20:00.000Z").getTime(),
    });
    const metadata = await extractPhotoUploadMetadata(file, {
      now: new Date("2026-02-16T00:00:00.000Z"),
      parseExifMetadata: async () => ({
        takenAtRaw: new Date("2026-02-12T10:30:00.000Z"),
      }),
    });

    expect(metadata.takenAt).toBe("2026-02-15T06:20:00.000Z");
  });

  test("extractPhotoUploadMetadata uses EXIF when lastModified is unavailable", async () => {
    const file = new File(["abc"], "IMG_20260214_091122.jpg", {
      type: "image/jpeg",
      lastModified: 0,
    });
    const metadata = await extractPhotoUploadMetadata(file, {
      parseExifMetadata: async () => ({
        takenAtRaw: new Date("2026-02-12T10:30:00.000Z"),
      }),
    });

    expect(metadata.takenAt).toBe("2026-02-12T10:30:00.000Z");
  });

  test("extractPhotoUploadMetadata extracts EXIF coordinates as location label", async () => {
    const file = new File(["abc"], "IMG_20260214_091122.jpg", {
      type: "image/jpeg",
    });
    const metadata = await extractPhotoUploadMetadata(file, {
      parseExifMetadata: async () => ({
        takenAtRaw: null,
        latitudeRaw: 37.5665,
        longitudeRaw: 126.978,
      }),
    });

    expect(metadata.locationLabel).toBe("위도 37.56650, 경도 126.97800");
  });

  test("extractPhotoUploadMetadata falls back to filename then now", async () => {
    const fileFromName = new File(["abc"], "IMG_20260214_091122.jpg", {
      type: "image/jpeg",
      lastModified: 0,
    });
    const byName = await extractPhotoUploadMetadata(fileFromName, {
      now: new Date("2026-02-16T00:00:00.000Z"),
      parseExifMetadata: async () => null,
    });
    expect(byName.takenAt).toBe("2026-02-14T09:11:22.000Z");

    const fileNoDate = new File(["abc"], "luda-family.jpg", {
      type: "image/jpeg",
      lastModified: 0,
    });
    const byNow = await extractPhotoUploadMetadata(fileNoDate, {
      now: new Date("2026-02-16T00:00:00.000Z"),
      parseExifMetadata: async () => {
        throw new Error("no exif");
      },
    });
    expect(byNow.takenAt).toBe("2026-02-16T00:00:00.000Z");
  });
});
