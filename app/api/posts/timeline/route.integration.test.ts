// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { listE2EFixturePhotosPage } from "@/lib/gallery/e2e-fixtures";
import { listPhotosPageFromDatabase } from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isE2EFixtureModeEnabled } from "@/lib/testing/e2e-fixture-mode";

import { GET } from "./route";

vi.mock("@/lib/gallery/repository", () => ({
  listPhotosPageFromDatabase: vi.fn(),
}));

vi.mock("@/lib/gallery/e2e-fixtures", () => ({
  listE2EFixturePhotosPage: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/testing/e2e-fixture-mode", () => ({
  isE2EFixtureModeEnabled: vi.fn(),
}));

const listPhotosPageFromDatabaseMock = vi.mocked(listPhotosPageFromDatabase);
const listE2EFixturePhotosPageMock = vi.mocked(listE2EFixturePhotosPage);
const createServerSupabaseClientMock = vi.mocked(createServerSupabaseClient);
const isE2EFixtureModeEnabledMock = vi.mocked(isE2EFixtureModeEnabled);

describe("GET /api/posts/timeline (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isE2EFixtureModeEnabledMock.mockReturnValue(false);
  });

  it("uses default limit=10 and returns items with nextCursor", async () => {
    const supabase = { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>;
    createServerSupabaseClientMock.mockReturnValue(supabase);
    listPhotosPageFromDatabaseMock.mockResolvedValue({
      items: [
        {
          id: "photo-1",
          src: "/photo-1.jpg",
          thumbSrc: null,
          alt: "photo-1",
          caption: "photo-1",
          eventNames: [],
          takenAt: "2026-02-16T08:00:00.000Z",
          updatedAt: "2026-02-16T08:00:00.000Z",
          visibility: "family",
          isFeatured: false,
          featuredRank: null,
        },
      ],
      nextCursor: "cursor-2",
      summary: {
        totalCount: 1,
        yearMonthStats: [],
      },
    });

    const response = await GET(new Request("http://localhost/api/posts/timeline"));

    expect(response.status).toBe(200);
    expect(listPhotosPageFromDatabaseMock).toHaveBeenCalledWith(supabase, {
      cursor: undefined,
      limit: 10,
      visibility: "family",
    });
    await expect(response.json()).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: "photo-1",
        }),
      ],
      nextCursor: "cursor-2",
    });
  });

  it("clamps oversized limits to 10", async () => {
    const supabase = { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>;
    createServerSupabaseClientMock.mockReturnValue(supabase);
    listPhotosPageFromDatabaseMock.mockResolvedValue({
      items: [],
      nextCursor: null,
      summary: {
        totalCount: 0,
        yearMonthStats: [],
      },
    });

    const response = await GET(
      new Request("http://localhost/api/posts/timeline?cursor=abc&limit=999"),
    );

    expect(response.status).toBe(200);
    expect(listPhotosPageFromDatabaseMock).toHaveBeenCalledWith(supabase, {
      cursor: "abc",
      limit: 10,
      visibility: "family",
    });
  });

  it("returns 400 when limit query is invalid", async () => {
    const response = await GET(
      new Request("http://localhost/api/posts/timeline?limit=oops"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "잘못된 쿼리 파라미터입니다.",
    });
  });

  it("returns fixture response when supabase is unavailable and fixture mode is on", async () => {
    createServerSupabaseClientMock.mockReturnValue(null);
    isE2EFixtureModeEnabledMock.mockReturnValue(true);
    listE2EFixturePhotosPageMock.mockReturnValue({
      items: [
        {
          id: "fixture-1",
          src: "/fixture.jpg",
          thumbSrc: null,
          alt: "fixture",
          caption: "fixture",
          eventNames: [],
          takenAt: "2026-02-16T08:00:00.000Z",
          updatedAt: "2026-02-16T08:00:00.000Z",
          visibility: "family",
          isFeatured: false,
          featuredRank: null,
        },
      ],
      nextCursor: "fixture-cursor",
      summary: {
        totalCount: 1,
        yearMonthStats: [],
      },
    });

    const response = await GET(
      new Request("http://localhost/api/posts/timeline?cursor=fixture&limit=10"),
    );

    expect(response.status).toBe(200);
    expect(listE2EFixturePhotosPageMock).toHaveBeenCalledWith({
      cursor: "fixture",
      limit: 10,
    });
    await expect(response.json()).resolves.toEqual({
      items: [expect.objectContaining({ id: "fixture-1" })],
      nextCursor: "fixture-cursor",
    });
  });
});
