// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PhotoListResponse } from "@/lib/gallery/types";
import { listPhotosPageFromDatabase } from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/gallery/repository", () => ({
  listPhotosPageFromDatabase: vi.fn(),
}));

const createServerSupabaseClientMock = vi.mocked(createServerSupabaseClient);
const listPhotosPageFromDatabaseMock = vi.mocked(listPhotosPageFromDatabase);

const createRequest = (query = "") => {
  return new Request(`http://localhost/api/photos${query ? `?${query}` : ""}`);
};

const emptySummary = {
  totalCount: 0,
  yearMonthStats: [],
};

describe("GET /api/photos (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on invalid query params", async () => {
    const response = await GET(createRequest("limit=foo"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "잘못된 쿼리 파라미터입니다.",
    });
  });

  it("returns fallback payload when supabase is unavailable", async () => {
    createServerSupabaseClientMock.mockReturnValue(null);

    const response = await GET(createRequest("year=2026&month=2&limit=24"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("s-maxage=60, stale-while-revalidate=600");
    await expect(response.json()).resolves.toEqual({
      items: [],
      nextCursor: null,
      summary: emptySummary,
    });
    expect(listPhotosPageFromDatabaseMock).not.toHaveBeenCalled();
  });

  it("passes cursor format and clamps limit before repository call", async () => {
    const supabase = { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>;
    const cursor = "2026-02-16T08:00:00.000Z|photo-99";
    const payload: PhotoListResponse = {
      items: [],
      nextCursor: "2026-02-15T08:00:00.000Z|photo-98",
      summary: emptySummary,
    };

    createServerSupabaseClientMock.mockReturnValue(supabase);
    listPhotosPageFromDatabaseMock.mockResolvedValue(payload);

    const response = await GET(
      createRequest(
        `year=2026&month=2&day=16&limit=999&cursor=${encodeURIComponent(cursor)}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(listPhotosPageFromDatabaseMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        cursor,
        limit: 96,
        year: 2026,
        month: 2,
        day: 16,
        visibility: "family",
      }),
    );
    await expect(response.json()).resolves.toEqual(payload);
  });

  it("returns 502 with Korean error copy when repository throws", async () => {
    const supabase = { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>;
    createServerSupabaseClientMock.mockReturnValue(supabase);
    listPhotosPageFromDatabaseMock.mockRejectedValue(new Error("boom"));

    const response = await GET(createRequest("year=2026&month=2"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "사진 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
    });
  });
});
