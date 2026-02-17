// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PhotoMonthPageResponse } from "@/lib/gallery/types";
import { listPhotosMonthPageFromDatabase } from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/gallery/repository", () => ({
  listPhotosMonthPageFromDatabase: vi.fn(),
}));

const createServerSupabaseClientMock = vi.mocked(createServerSupabaseClient);
const listPhotosMonthPageFromDatabaseMock = vi.mocked(listPhotosMonthPageFromDatabase);

const createRequest = (query = "") => {
  return new Request(`http://localhost/api/photos/month${query ? `?${query}` : ""}`);
};

describe("GET /api/photos/month (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on malformed integer params", async () => {
    const response = await GET(createRequest("year=2026&month=abc"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "잘못된 쿼리 파라미터입니다.",
    });
  });

  it("returns 400 when month range is invalid", async () => {
    const response = await GET(createRequest("year=2026&month=13"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "year와 month(1~12)는 필수입니다.",
    });
  });

  it("returns empty month response on supabase fallback", async () => {
    createServerSupabaseClientMock.mockReturnValue(null);

    const response = await GET(createRequest("year=2026&month=2&limit=24"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("s-maxage=60, stale-while-revalidate=600");
    await expect(response.json()).resolves.toEqual({
      year: 2026,
      month: 2,
      key: "2026-02",
      items: [],
      nextCursor: null,
    });
    expect(listPhotosMonthPageFromDatabaseMock).not.toHaveBeenCalled();
  });

  it("applies cursor and limit clamp for month queries", async () => {
    const supabase = { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>;
    const payload: PhotoMonthPageResponse = {
      year: 2026,
      month: 2,
      key: "2026-02",
      items: [],
      nextCursor: "2026-02-12T00:00:00.000Z|photo-2",
    };

    createServerSupabaseClientMock.mockReturnValue(supabase);
    listPhotosMonthPageFromDatabaseMock.mockResolvedValue(payload);

    const response = await GET(
      createRequest(
        `year=2026&month=2&limit=500&cursor=${encodeURIComponent(
          "2026-02-15T00:00:00.000Z|photo-3",
        )}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(listPhotosMonthPageFromDatabaseMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        year: 2026,
        month: 2,
        cursor: "2026-02-15T00:00:00.000Z|photo-3",
        limit: 96,
        visibility: "family",
      }),
    );
    await expect(response.json()).resolves.toEqual(payload);
  });

  it("returns 502 when repository call fails", async () => {
    const supabase = { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>;
    createServerSupabaseClientMock.mockReturnValue(supabase);
    listPhotosMonthPageFromDatabaseMock.mockRejectedValue(new Error("boom"));

    const response = await GET(createRequest("year=2026&month=2"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "월별 사진을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
    });
  });
});
