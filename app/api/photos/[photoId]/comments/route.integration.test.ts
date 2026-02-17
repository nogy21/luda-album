// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PhotoCommentRow } from "@/lib/gallery/comment-types";
import {
  createPhotoComment,
  listPhotoComments,
} from "@/lib/gallery/comment-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { GET, POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/gallery/comment-repository", () => ({
  listPhotoComments: vi.fn(),
  createPhotoComment: vi.fn(),
}));

const createServerSupabaseClientMock = vi.mocked(createServerSupabaseClient);
const listPhotoCommentsMock = vi.mocked(listPhotoComments);
const createPhotoCommentMock = vi.mocked(createPhotoComment);

const params = (photoId: string) => ({
  params: Promise.resolve({ photoId }),
});

describe("GET/POST /api/photos/[photoId]/comments (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns newest-first comments from repository", async () => {
    const supabase = { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>;
    const items: PhotoCommentRow[] = [
      {
        id: "c2",
        photo_id: "p1",
        nickname: "엄마",
        message: "둘째 댓글",
        created_at: "2026-02-16T10:01:00.000Z",
      },
      {
        id: "c1",
        photo_id: "p1",
        nickname: "아빠",
        message: "첫 댓글",
        created_at: "2026-02-16T10:00:00.000Z",
      },
    ];

    createServerSupabaseClientMock.mockReturnValue(supabase);
    listPhotoCommentsMock.mockResolvedValue(items);

    const response = await GET(new Request("http://localhost/api/photos/p1/comments"), params("p1"));

    expect(response.status).toBe(200);
    expect(listPhotoCommentsMock).toHaveBeenCalledWith(supabase, "p1");
    await expect(response.json()).resolves.toEqual({ items });
  });

  it("falls back to in-memory comments on GET when supabase is unavailable", async () => {
    createServerSupabaseClientMock.mockReturnValue(null);

    const response = await GET(new Request("http://localhost/api/photos/p2/comments"), params("p2"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [] });
  });

  it("validates comment payload length and returns Korean error", async () => {
    const response = await POST(
      new Request("http://localhost/api/photos/p1/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: "닉네임",
          message: "a".repeat(301),
        }),
      }),
      params("p1"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "댓글은 300자 이하로 작성해 주세요.",
    });
  });

  it("creates fallback comment when supabase is unavailable", async () => {
    createServerSupabaseClientMock.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/photos/p9/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: "  ",
          message: "  루다야 메리크리스마스!  ",
        }),
      }),
      params("p9"),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        photo_id: "p9",
        nickname: "익명의 팬",
        message: "루다야 메리크리스마스!",
      }),
    );
  });

  it("returns created repository comment on POST success", async () => {
    const supabase = { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>;
    const created: PhotoCommentRow = {
      id: "c-created",
      photo_id: "p3",
      nickname: "할머니",
      message: "잘했어요",
      created_at: "2026-02-16T10:02:00.000Z",
    };

    createServerSupabaseClientMock.mockReturnValue(supabase);
    createPhotoCommentMock.mockResolvedValue(created);

    const response = await POST(
      new Request("http://localhost/api/photos/p3/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: "할머니",
          message: "잘했어요",
        }),
      }),
      params("p3"),
    );

    expect(response.status).toBe(201);
    expect(createPhotoCommentMock).toHaveBeenCalledWith(
      supabase,
      "p3",
      {
        nickname: "할머니",
        message: "잘했어요",
      },
    );
    await expect(response.json()).resolves.toEqual(created);
  });
});
