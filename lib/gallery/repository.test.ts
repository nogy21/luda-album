import { describe, expect, test, vi } from "vitest";

import {
  createGalleryImageRecord,
  listGalleryImagesFromDatabase,
  listPhotoHighlightsFromDatabase,
  listPhotosPageFromDatabase,
} from "./repository";

type QueryResult<T> = {
  data: T;
  error: { message: string } | null;
};

type MockQueryBuilder = PromiseLike<QueryResult<unknown>> & {
  select: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

const createBuilder = <T>(result: QueryResult<T>): MockQueryBuilder => {
  const builder = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
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
  builder.gte.mockReturnValue(builder);
  builder.lt.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
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
});
