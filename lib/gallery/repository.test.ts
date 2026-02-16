import { describe, expect, test, vi } from "vitest";

import {
  createGalleryImageRecord,
  deleteGalleryPhotoRecord,
  listAdminPhotosPageFromDatabase,
  listGalleryImagesFromDatabase,
  listPhotoHighlightsFromDatabase,
  listPhotoSummaryFromDatabase,
  listPhotosMonthPageFromDatabase,
  listPhotosPageFromDatabase,
  updateGalleryPhotoMetadata,
} from "./repository";

type QueryResult<T> = {
  data: T;
  error: { message: string } | null;
};

type MockQueryBuilder = PromiseLike<QueryResult<unknown>> & {
  select: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

const createBuilder = <T>(result: QueryResult<T>): MockQueryBuilder => {
  const builder = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    then: (
      onFulfilled?: (value: QueryResult<unknown>) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      return Promise.resolve(result as QueryResult<unknown>).then(onFulfilled, onRejected);
    },
  } as unknown as MockQueryBuilder;

  builder.select.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lt.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue(result);

  return builder;
};

describe("gallery repository", () => {
  test("listGalleryImagesFromDatabase maps rows and applies family visibility", async () => {
    const rows = [
      {
        id: "2",
        src: "https://example.com/2.jpg",
        thumb_src: "https://example.com/thumb-2.jpg",
        alt: "둘째 사진",
        caption: "둘째",
        taken_at: "2026-02-11T10:00:00.000Z",
        updated_at: "2026-02-12T10:00:00.000Z",
        visibility: "family",
        is_featured: false,
        featured_rank: null,
      },
      {
        id: "1",
        src: "https://example.com/1.jpg",
        thumb_src: null,
        alt: "첫째 사진",
        caption: "첫째",
        taken_at: "2026-02-10T10:00:00.000Z",
        updated_at: "2026-02-10T10:00:00.000Z",
        visibility: "family",
        is_featured: true,
        featured_rank: 1,
      },
    ];

    const listBuilder = createBuilder({ data: rows, error: null });
    const from = vi.fn(() => listBuilder);

    const result = await listGalleryImagesFromDatabase({ from }, "gallery_photos");

    expect(from).toHaveBeenCalledWith("gallery_photos");
    expect(listBuilder.select).toHaveBeenCalledWith(
      "id, src, thumb_src, alt, caption, taken_at, updated_at, visibility, is_featured, featured_rank",
    );
    expect(listBuilder.eq).toHaveBeenCalledWith("visibility", "family");
    expect(result).toEqual([
      {
        id: "2",
        src: "https://example.com/2.jpg",
        thumbSrc: "https://example.com/thumb-2.jpg",
        alt: "둘째 사진",
        caption: "둘째",
        takenAt: "2026-02-11T10:00:00.000Z",
        updatedAt: "2026-02-12T10:00:00.000Z",
        visibility: "family",
        isFeatured: false,
        featuredRank: null,
      },
      {
        id: "1",
        src: "https://example.com/1.jpg",
        thumbSrc: null,
        alt: "첫째 사진",
        caption: "첫째",
        takenAt: "2026-02-10T10:00:00.000Z",
        updatedAt: "2026-02-10T10:00:00.000Z",
        visibility: "family",
        isFeatured: true,
        featuredRank: 1,
      },
    ]);
  });

  test("listPhotosPageFromDatabase returns cursor page and summary metadata", async () => {
    const pageRows = [
      {
        id: "3",
        src: "https://example.com/3.jpg",
        thumb_src: "https://example.com/thumb-3.jpg",
        alt: "셋째 사진",
        caption: "셋째",
        taken_at: "2026-02-12T10:00:00.000Z",
        updated_at: "2026-02-13T10:00:00.000Z",
        visibility: "family",
        is_featured: true,
        featured_rank: 1,
      },
      {
        id: "2",
        src: "https://example.com/2.jpg",
        thumb_src: null,
        alt: "둘째 사진",
        caption: "둘째",
        taken_at: "2026-02-11T10:00:00.000Z",
        updated_at: "2026-02-11T10:00:00.000Z",
        visibility: "family",
        is_featured: false,
        featured_rank: null,
      },
      {
        id: "1",
        src: "https://example.com/1.jpg",
        thumb_src: null,
        alt: "첫째 사진",
        caption: "첫째",
        taken_at: "2026-02-10T10:00:00.000Z",
        updated_at: "2026-02-10T10:00:00.000Z",
        visibility: "family",
        is_featured: false,
        featured_rank: null,
      },
    ];

    const summaryRows = pageRows.map((item) => ({
      id: item.id,
      taken_at: item.taken_at,
      updated_at: item.updated_at,
    }));

    const pageBuilder = createBuilder({ data: pageRows, error: null });
    const summaryBuilder = createBuilder({ data: summaryRows, error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(pageBuilder)
      .mockReturnValueOnce(summaryBuilder);

    const result = await listPhotosPageFromDatabase(
      { from },
      {
        cursor: "2026-02-14T00:00:00.000Z|cursor-id",
        limit: 2,
        year: 2026,
        month: 2,
        visibility: "family",
      },
      "gallery_photos",
    );

    expect(pageBuilder.limit).toHaveBeenCalledWith(3);
    expect(pageBuilder.lt).toHaveBeenCalledWith("taken_at", "2026-02-14T00:00:00.000Z");
    expect(pageBuilder.gte).toHaveBeenCalledWith("taken_at", "2026-02-01T00:00:00.000Z");
    expect(pageBuilder.lt).toHaveBeenCalledWith("taken_at", "2026-03-01T00:00:00.000Z");
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("2026-02-11T10:00:00.000Z|2");
    expect(result.summary.totalCount).toBe(3);
    expect(result.summary.yearMonthStats[0]).toMatchObject({
      key: "2026-02",
      count: 3,
      label: "2026년 2월",
    });
  });

  test("listPhotoSummaryFromDatabase groups and orders month buckets", async () => {
    const summaryRows = [
      {
        id: "3",
        taken_at: "2026-02-12T10:00:00.000Z",
        updated_at: "2026-02-13T10:00:00.000Z",
      },
      {
        id: "2",
        taken_at: "2026-01-12T10:00:00.000Z",
        updated_at: "2026-01-12T10:00:00.000Z",
      },
      {
        id: "1",
        taken_at: "2026-02-10T10:00:00.000Z",
        updated_at: "2026-02-10T10:00:00.000Z",
      },
    ];

    const summaryBuilder = createBuilder({ data: summaryRows, error: null });
    const from = vi.fn(() => summaryBuilder);

    const result = await listPhotoSummaryFromDatabase(
      { from },
      { visibility: "family" },
      "gallery_photos",
    );

    expect(result.totalCount).toBe(3);
    expect(result.months.map((month) => month.key)).toEqual(["2026-02", "2026-01"]);
    expect(result.months[0]).toMatchObject({
      year: 2026,
      month: 2,
      count: 2,
      label: "2026년 2월",
    });
  });

  test("listPhotosMonthPageFromDatabase applies month range and cursor pagination", async () => {
    const rows = [
      {
        id: "3",
        src: "https://example.com/3.jpg",
        thumb_src: "https://example.com/thumb-3.jpg",
        alt: "셋째 사진",
        caption: "셋째",
        taken_at: "2026-02-12T10:00:00.000Z",
        updated_at: "2026-02-13T10:00:00.000Z",
        visibility: "family",
        is_featured: false,
        featured_rank: null,
      },
      {
        id: "2",
        src: "https://example.com/2.jpg",
        thumb_src: null,
        alt: "둘째 사진",
        caption: "둘째",
        taken_at: "2026-02-11T10:00:00.000Z",
        updated_at: "2026-02-11T10:00:00.000Z",
        visibility: "family",
        is_featured: false,
        featured_rank: null,
      },
      {
        id: "1",
        src: "https://example.com/1.jpg",
        thumb_src: null,
        alt: "첫째 사진",
        caption: "첫째",
        taken_at: "2026-02-10T10:00:00.000Z",
        updated_at: "2026-02-10T10:00:00.000Z",
        visibility: "family",
        is_featured: false,
        featured_rank: null,
      },
    ];

    const pageBuilder = createBuilder({ data: rows, error: null });
    const from = vi.fn(() => pageBuilder);

    const result = await listPhotosMonthPageFromDatabase(
      { from },
      {
        year: 2026,
        month: 2,
        cursor: "2026-02-14T00:00:00.000Z|cursor-id",
        limit: 2,
        visibility: "family",
      },
      "gallery_photos",
    );

    expect(from).toHaveBeenCalledWith("gallery_photos");
    expect(pageBuilder.eq).toHaveBeenCalledWith("visibility", "family");
    expect(pageBuilder.gte).toHaveBeenCalledWith("taken_at", "2026-02-01T00:00:00.000Z");
    expect(pageBuilder.lt).toHaveBeenCalledWith("taken_at", "2026-03-01T00:00:00.000Z");
    expect(pageBuilder.lt).toHaveBeenCalledWith("taken_at", "2026-02-14T00:00:00.000Z");
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("2026-02-11T10:00:00.000Z|2");
  });

  test("listPhotoHighlightsFromDatabase prefers featured and excludes overlap", async () => {
    const featuredRows = [
      {
        id: "featured",
        src: "https://example.com/featured.jpg",
        thumb_src: null,
        alt: "대표",
        caption: "대표",
        taken_at: "2026-02-13T10:00:00.000Z",
        updated_at: "2026-02-13T10:00:00.000Z",
        visibility: "family",
        is_featured: true,
        featured_rank: 1,
      },
    ];

    const latestRows = [
      ...featuredRows,
      {
        id: "latest-1",
        src: "https://example.com/latest-1.jpg",
        thumb_src: null,
        alt: "최신1",
        caption: "최신1",
        taken_at: "2026-02-12T10:00:00.000Z",
        updated_at: "2026-02-12T10:00:00.000Z",
        visibility: "family",
        is_featured: false,
        featured_rank: null,
      },
      {
        id: "latest-2",
        src: "https://example.com/latest-2.jpg",
        thumb_src: null,
        alt: "최신2",
        caption: "최신2",
        taken_at: "2026-02-11T10:00:00.000Z",
        updated_at: "2026-02-11T10:00:00.000Z",
        visibility: "family",
        is_featured: false,
        featured_rank: null,
      },
    ];

    const featuredBuilder = createBuilder({ data: featuredRows, error: null });
    const latestBuilder = createBuilder({ data: latestRows, error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(featuredBuilder)
      .mockReturnValueOnce(latestBuilder);

    const result = await listPhotoHighlightsFromDatabase(
      { from },
      { featuredLimit: 2, highlightLimit: 2, visibility: "family" },
      "gallery_photos",
    );

    expect(result.featured).toHaveLength(2);
    expect(result.highlights.map((item) => item.id)).toEqual(["latest-2"]);
  });

  test("createGalleryImageRecord inserts row with new fields", async () => {
    const createdRow = {
      id: "3",
      src: "https://example.com/upload.jpg",
      thumb_src: "https://example.com/upload-thumb.jpg",
      alt: "luda moment 사진",
      caption: "luda moment",
      taken_at: "2026-02-12T10:00:00.000Z",
      updated_at: "2026-02-12T10:00:00.000Z",
      visibility: "family",
      is_featured: false,
      featured_rank: null,
    };

    const insertBuilder = createBuilder({ data: createdRow, error: null });
    const from = vi.fn(() => insertBuilder);

    const result = await createGalleryImageRecord(
      { from },
      {
        src: "https://example.com/upload.jpg",
        thumbSrc: "https://example.com/upload-thumb.jpg",
        storagePath: "2026/02/14/uuid-luda-moment.jpg",
        originalName: "luda-moment.jpg",
        type: "image/jpeg",
        size: 1234,
      },
      "gallery_photos",
    );

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        src: "https://example.com/upload.jpg",
        thumb_src: "https://example.com/upload-thumb.jpg",
        storage_path: "2026/02/14/uuid-luda-moment.jpg",
        month_key: "2026-02",
        visibility: "family",
      }),
    );
    expect(result).toMatchObject({
      id: "3",
      src: "https://example.com/upload.jpg",
      thumbSrc: "https://example.com/upload-thumb.jpg",
      visibility: "family",
    });
  });

  test("createGalleryImageRecord throws when required columns are missing", async () => {
    const modernInsertBuilder = createBuilder({
      data: null,
      error: {
        message: "Could not find the 'alt' column of 'gallery_photos' in the schema cache",
      },
    });
    const from = vi.fn(() => modernInsertBuilder);

    await expect(
      createGalleryImageRecord(
        { from },
        {
          src: "https://example.com/upload.jpg",
          thumbSrc: "https://example.com/upload-thumb.jpg",
          storagePath: "2026/02/14/uuid-luda-moment.jpg",
          originalName: "luda-moment.jpg",
          type: "image/jpeg",
          size: 1234,
          takenAt: "2026-02-12T10:00:00.000Z",
        },
        "gallery_photos",
      ),
    ).rejects.toThrow("Failed to create gallery image record");
  });

  test("listAdminPhotosPageFromDatabase returns page with cursor", async () => {
    const rows = [
      {
        id: "2",
        src: "https://example.com/2.jpg",
        thumb_src: "https://example.com/thumb-2.jpg",
        alt: "둘째 사진",
        caption: "둘째",
        taken_at: "2026-02-11T10:00:00.000Z",
        updated_at: "2026-02-11T10:00:00.000Z",
        visibility: "family",
        is_featured: false,
        featured_rank: null,
      },
      {
        id: "1",
        src: "https://example.com/1.jpg",
        thumb_src: null,
        alt: "첫째 사진",
        caption: "첫째",
        taken_at: "2026-02-10T10:00:00.000Z",
        updated_at: "2026-02-10T10:00:00.000Z",
        visibility: "admin",
        is_featured: true,
        featured_rank: 1,
      },
    ];

    const builder = createBuilder({ data: rows, error: null });
    const from = vi.fn(() => builder);

    const result = await listAdminPhotosPageFromDatabase(
      { from },
      {
        limit: 1,
      },
      "gallery_photos",
    );

    expect(builder.limit).toHaveBeenCalledWith(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "2",
      caption: "둘째",
      visibility: "family",
    });
    expect(result.nextCursor).toBe("2026-02-11T10:00:00.000Z|2");
  });

  test("listAdminPhotosPageFromDatabase includes mapped eventNames", async () => {
    const rows = [
      {
        id: "2",
        src: "https://example.com/2.jpg",
        thumb_src: "https://example.com/thumb-2.jpg",
        alt: "둘째 사진",
        caption: "둘째",
        taken_at: "2026-02-11T10:00:00.000Z",
        updated_at: "2026-02-11T10:00:00.000Z",
        visibility: "family",
        is_featured: false,
        featured_rank: null,
      },
    ];
    const pageBuilder = createBuilder({ data: rows, error: null });
    const relationBuilder = createBuilder({
      data: [{ photo_id: "2", event_id: "event-a" }],
      error: null,
    });
    const eventBuilder = createBuilder({
      data: [{ id: "event-a", name: "여행", normalized_name: "여행" }],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "gallery_photos") {
        return pageBuilder;
      }

      if (table === "gallery_photo_events") {
        return relationBuilder;
      }

      if (table === "gallery_events") {
        return eventBuilder;
      }

      throw new Error(`unexpected table ${table}`);
    });

    const result = await listAdminPhotosPageFromDatabase(
      { from },
      {
        limit: 10,
      },
      "gallery_photos",
    );

    expect(result.items[0]?.eventNames).toEqual(["여행"]);
  });

  test("updateGalleryPhotoMetadata updates caption and takenAt with derived alt", async () => {
    const updatedRow = {
      id: "photo-1",
      src: "https://example.com/1.jpg",
      thumb_src: null,
      alt: "업데이트 캡션 사진",
      caption: "업데이트 캡션",
      taken_at: "2026-02-16T09:00:00.000Z",
      updated_at: "2026-02-16T09:30:00.000Z",
      visibility: "family",
      is_featured: false,
      featured_rank: null,
    };
    const builder = createBuilder({ data: updatedRow, error: null });
    const from = vi.fn(() => builder);

    const result = await updateGalleryPhotoMetadata(
      { from },
      {
        photoId: "photo-1",
        caption: "업데이트 캡션",
        takenAt: "2026-02-16T09:00:00.000Z",
      },
      "gallery_photos",
    );

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        caption: "업데이트 캡션",
        alt: "업데이트 캡션 사진",
        taken_at: "2026-02-16T09:00:00.000Z",
        month_key: "2026-02",
      }),
    );
    expect(result.caption).toBe("업데이트 캡션");
    expect(result.takenAt).toBe("2026-02-16T09:00:00.000Z");
  });

  test("updateGalleryPhotoMetadata rejects too long caption", async () => {
    const from = vi.fn();

    await expect(
      updateGalleryPhotoMetadata(
        { from },
        {
          photoId: "photo-1",
          caption: "가".repeat(121),
        },
        "gallery_photos",
      ),
    ).rejects.toThrow("caption은 120자 이하여야 해요.");
  });

  test("updateGalleryPhotoMetadata replaces event names", async () => {
    const updatedRow = {
      id: "photo-1",
      src: "https://example.com/1.jpg",
      thumb_src: null,
      alt: "업데이트 캡션 사진",
      caption: "업데이트 캡션",
      taken_at: "2026-02-16T09:00:00.000Z",
      updated_at: "2026-02-16T09:30:00.000Z",
      visibility: "family",
      is_featured: false,
      featured_rank: null,
    };
    const photoBuilder = createBuilder({ data: updatedRow, error: null });
    const relationBuilder = {
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
    const eventsBuilder = {
      upsert: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      select: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({
          data: [
            { id: "event-a", name: "여행", normalized_name: "여행" },
            { id: "event-b", name: "돌잔치", normalized_name: "돌잔치" },
          ],
          error: null,
        }),
      })),
    };
    const from = vi.fn((table: string) => {
      if (table === "gallery_photos") {
        return photoBuilder;
      }

      if (table === "gallery_photo_events") {
        return relationBuilder;
      }

      if (table === "gallery_events") {
        return eventsBuilder;
      }

      throw new Error(`unexpected table ${table}`);
    });

    const result = await updateGalleryPhotoMetadata(
      { from },
      {
        photoId: "photo-1",
        eventNames: ["여행", "돌잔치"],
      },
      "gallery_photos",
    );

    expect(result.eventNames).toEqual(["여행", "돌잔치"]);
  });

  test("deleteGalleryPhotoRecord deletes row and returns storage path", async () => {
    const deletedRow = {
      id: "photo-1",
      storage_path: "2026/02/14/photo-1.jpg",
      taken_at: "2026-02-14T10:00:00.000Z",
      created_at: "2026-02-14T10:00:00.000Z",
    };
    const builder = createBuilder({ data: deletedRow, error: null });
    const from = vi.fn(() => builder);

    const result = await deleteGalleryPhotoRecord(
      { from },
      { photoId: "photo-1" },
      "gallery_photos",
    );

    expect(builder.delete).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith("id", "photo-1");
    expect(result).toEqual({
      id: "photo-1",
      storagePath: "2026/02/14/photo-1.jpg",
    });
  });
});
