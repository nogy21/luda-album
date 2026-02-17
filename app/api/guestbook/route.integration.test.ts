// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GuestbookRow } from "@/lib/guestbook/types";
import {
  createGuestbookMessage,
  listGuestbookMessages,
} from "@/lib/guestbook/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { GET, POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/guestbook/repository", () => ({
  listGuestbookMessages: vi.fn(),
  createGuestbookMessage: vi.fn(),
}));

const createServerSupabaseClientMock = vi.mocked(createServerSupabaseClient);
const listGuestbookMessagesMock = vi.mocked(listGuestbookMessages);
const createGuestbookMessageMock = vi.mocked(createGuestbookMessage);

describe("GET/POST /api/guestbook (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fallback seed messages when supabase is unavailable", async () => {
    createServerSupabaseClientMock.mockReturnValue(null);

    const response = await GET();
    const payload = (await response.json()) as GuestbookRow[];

    expect(response.status).toBe(200);
    expect(payload.length).toBeGreaterThan(0);
    expect(payload[0]?.id).toBe("seed-2");
    expect(listGuestbookMessagesMock).not.toHaveBeenCalled();
  });

  it("returns 500 with Korean copy when guestbook listing fails", async () => {
    const supabase = { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>;
    createServerSupabaseClientMock.mockReturnValue(supabase);
    listGuestbookMessagesMock.mockRejectedValue(new Error("boom"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "덕담 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
    });
  });

  it("rejects empty guestbook message", async () => {
    const response = await POST(
      new Request("http://localhost/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: "루다팬",
          message: "   ",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "덕담 내용을 입력해 주세요.",
    });
  });

  it("stores normalized fallback guestbook message without supabase", async () => {
    createServerSupabaseClientMock.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: "   ",
          message: "  루다야 항상 건강하자  ",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        nickname: "익명의 팬",
        message: "루다야 항상 건강하자",
      }),
    );
  });

  it("returns repository-created message on POST success", async () => {
    const supabase = { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>;
    const created: GuestbookRow = {
      id: "g-created",
      nickname: "할머니",
      message: "언제나 사랑해",
      created_at: "2026-02-16T10:00:00.000Z",
    };

    createServerSupabaseClientMock.mockReturnValue(supabase);
    createGuestbookMessageMock.mockResolvedValue(created);

    const response = await POST(
      new Request("http://localhost/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: "할머니",
          message: "언제나 사랑해",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createGuestbookMessageMock).toHaveBeenCalledWith(supabase, {
      nickname: "할머니",
      message: "언제나 사랑해",
    });
    await expect(response.json()).resolves.toEqual(created);
  });
});
