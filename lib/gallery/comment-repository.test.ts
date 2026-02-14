import { describe, expect, test, vi } from "vitest";

import { createPhotoComment, listPhotoComments } from "./comment-repository";
import type { CreatePhotoCommentPayload, PhotoCommentRow } from "./comment-types";

type MockQueryResult<T> = Promise<{ data: T; error: { message: string } | null }>;

describe("photo comment repository", () => {
  test("listPhotoComments returns latest-first comments by photo", async () => {
    const rows: PhotoCommentRow[] = [
      {
        id: "2",
        photo_id: "p1",
        nickname: "엄마",
        message: "귀여워",
        created_at: "2026-02-15T10:00:00.000Z",
      },
      {
        id: "1",
        photo_id: "p1",
        nickname: "아빠",
        message: "사랑해",
        created_at: "2026-02-14T10:00:00.000Z",
      },
    ];

    const order = vi.fn(
      () => Promise.resolve({ data: rows, error: null }) as MockQueryResult<PhotoCommentRow[]>,
    );
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const result = await listPhotoComments({ from }, "p1");

    expect(from).toHaveBeenCalledWith("photo_comments");
    expect(select).toHaveBeenCalledWith("*");
    expect(eq).toHaveBeenCalledWith("photo_id", "p1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual(rows);
  });

  test("createPhotoComment inserts and returns created row", async () => {
    const payload: CreatePhotoCommentPayload = {
      nickname: "이모",
      message: "웃는 모습 최고",
    };

    const created: PhotoCommentRow = {
      id: "3",
      photo_id: "p2",
      nickname: "이모",
      message: "웃는 모습 최고",
      created_at: "2026-02-15T11:00:00.000Z",
    };

    const single = vi.fn(
      () => Promise.resolve({ data: created, error: null }) as MockQueryResult<PhotoCommentRow>,
    );
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));

    const result = await createPhotoComment({ from }, "p2", payload);

    expect(from).toHaveBeenCalledWith("photo_comments");
    expect(insert).toHaveBeenCalledWith({
      photo_id: "p2",
      nickname: "이모",
      message: "웃는 모습 최고",
    });
    expect(select).toHaveBeenCalledWith("*");
    expect(result).toEqual(created);
  });
});
