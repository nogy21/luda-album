import { describe, expect, test, vi } from "vitest";

import { createGuestbookMessage, listGuestbookMessages } from "./repository";
import type { CreateGuestbookPayload, GuestbookRow } from "./types";

type MockQueryResult<T> = Promise<{ data: T; error: { message: string } | null }>;

describe("guestbook repository", () => {
  test("listGuestbookMessages returns latest-first messages", async () => {
    const rows: GuestbookRow[] = [
      {
        id: "2",
        nickname: "B",
        message: "second",
        created_at: "2026-02-12T10:00:00.000Z",
      },
      {
        id: "1",
        nickname: "A",
        message: "first",
        created_at: "2026-02-11T10:00:00.000Z",
      },
    ];

    const order = vi.fn(
      () => Promise.resolve({ data: rows, error: null }) as MockQueryResult<GuestbookRow[]>,
    );
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select }));

    const result = await listGuestbookMessages({ from });

    expect(from).toHaveBeenCalledWith("guestbook");
    expect(select).toHaveBeenCalledWith("*");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual(rows);
  });

  test("createGuestbookMessage inserts and returns created row", async () => {
    const payload: CreateGuestbookPayload = {
      nickname: "Guest",
      message: "Happy New Year",
    };

    const createdRow: GuestbookRow = {
      id: "3",
      nickname: "Guest",
      message: "Happy New Year",
      created_at: "2026-02-12T11:00:00.000Z",
    };

    const single = vi.fn(
      () => Promise.resolve({ data: createdRow, error: null }) as MockQueryResult<GuestbookRow>,
    );
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));

    const result = await createGuestbookMessage({ from }, payload);

    expect(from).toHaveBeenCalledWith("guestbook");
    expect(insert).toHaveBeenCalledWith(payload);
    expect(select).toHaveBeenCalledWith("*");
    expect(result).toEqual(createdRow);
  });
});
