import { describe, expect, test, vi } from "vitest";

import {
  createGalleryImageRecord,
  listGalleryImagesFromDatabase,
} from "./repository";

type MockQueryResult<T> = Promise<{ data: T; error: { message: string } | null }>;

describe("gallery repository", () => {
  test("listGalleryImagesFromDatabase returns mapped gallery images", async () => {
    const rows = [
      {
        id: "2",
        src: "https://example.com/2.jpg",
        alt: "둘째 사진",
        caption: "둘째",
        taken_at: "2026-02-11T10:00:00.000Z",
      },
      {
        id: "1",
        src: "https://example.com/1.jpg",
        alt: "첫째 사진",
        caption: "첫째",
        taken_at: "2026-02-10T10:00:00.000Z",
      },
    ];

    const order = vi.fn(
      () => Promise.resolve({ data: rows, error: null }) as MockQueryResult<typeof rows>,
    );
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select }));

    const result = await listGalleryImagesFromDatabase({ from }, "gallery_photos");

    expect(from).toHaveBeenCalledWith("gallery_photos");
    expect(select).toHaveBeenCalledWith("id, src, alt, caption, taken_at");
    expect(order).toHaveBeenCalledWith("taken_at", { ascending: false });
    expect(result).toEqual([
      {
        id: "2",
        src: "https://example.com/2.jpg",
        alt: "둘째 사진",
        caption: "둘째",
        takenAt: "2026-02-11T10:00:00.000Z",
      },
      {
        id: "1",
        src: "https://example.com/1.jpg",
        alt: "첫째 사진",
        caption: "첫째",
        takenAt: "2026-02-10T10:00:00.000Z",
      },
    ]);
  });

  test("createGalleryImageRecord inserts row and returns mapped image", async () => {
    const createdRow = {
      id: "3",
      src: "https://example.com/upload.jpg",
      alt: "luda moment 사진",
      caption: "luda moment",
      taken_at: "2026-02-12T10:00:00.000Z",
    };
    const single = vi.fn(
      () =>
        Promise.resolve({
          data: createdRow,
          error: null,
        }) as MockQueryResult<typeof createdRow>,
    );
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));

    const result = await createGalleryImageRecord(
      { from },
      {
        src: "https://example.com/upload.jpg",
        storagePath: "2026/02/14/uuid-luda-moment.jpg",
        originalName: "luda-moment.jpg",
        type: "image/jpeg",
        size: 1234,
      },
      "gallery_photos",
    );

    expect(from).toHaveBeenCalledWith("gallery_photos");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        src: "https://example.com/upload.jpg",
        storage_path: "2026/02/14/uuid-luda-moment.jpg",
        original_name: "luda-moment.jpg",
        type: "image/jpeg",
        size: 1234,
        caption: "luda moment",
        alt: "luda moment 사진",
      }),
    );
    expect(result).toEqual({
      id: "3",
      src: "https://example.com/upload.jpg",
      alt: "luda moment 사진",
      caption: "luda moment",
      takenAt: "2026-02-12T10:00:00.000Z",
    });
  });
});

