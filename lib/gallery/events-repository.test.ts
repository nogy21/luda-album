import { describe, expect, test, vi } from "vitest";

import {
  listEventNamesByPhotoIds,
  listEventSuggestions,
  replacePhotoEvents,
  upsertEventNames,
} from "./events-repository";

describe("gallery events repository", () => {
  test("upsertEventNames normalizes and deduplicates names", async () => {
    const upsertSelect = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectIn = vi.fn().mockResolvedValue({
      data: [
        { id: "event-a", name: "여행", normalized_name: "여행" },
        { id: "event-b", name: "돌잔치", normalized_name: "돌잔치" },
      ],
      error: null,
    });
    const eventsBuilder = {
      upsert: vi.fn(() => ({
        select: upsertSelect,
      })),
      select: vi.fn(() => ({
        in: selectIn,
      })),
    };
    const from = vi.fn((table: string) => {
      if (table === "gallery_events") {
        return eventsBuilder;
      }

      throw new Error(`unexpected table ${table}`);
    });

    const rows = await upsertEventNames({ from }, [" 여행 ", "여행", "돌잔치"]);

    expect(eventsBuilder.upsert).toHaveBeenCalledWith(
      [
        { name: "여행", normalized_name: "여행" },
        { name: "돌잔치", normalized_name: "돌잔치" },
      ],
      { onConflict: "normalized_name" },
    );
    expect(rows.map((row) => row.name)).toEqual(["여행", "돌잔치"]);
  });

  test("replacePhotoEvents rewrites photo-event links", async () => {
    const relationEq = vi.fn().mockResolvedValue({ error: null });
    const relationInsert = vi.fn().mockResolvedValue({ error: null });
    const photoEventsBuilder = {
      delete: vi.fn(() => ({
        eq: relationEq,
      })),
      insert: relationInsert,
    };

    const upsertSelect = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectIn = vi.fn().mockResolvedValue({
      data: [
        { id: "event-a", name: "여행", normalized_name: "여행" },
        { id: "event-b", name: "돌잔치", normalized_name: "돌잔치" },
      ],
      error: null,
    });
    const eventsBuilder = {
      upsert: vi.fn(() => ({
        select: upsertSelect,
      })),
      select: vi.fn(() => ({
        in: selectIn,
      })),
    };

    const from = vi.fn((table: string) => {
      if (table === "gallery_photo_events") {
        return photoEventsBuilder;
      }

      if (table === "gallery_events") {
        return eventsBuilder;
      }

      throw new Error(`unexpected table ${table}`);
    });

    const names = await replacePhotoEvents({ from }, "photo-1", ["여행", "돌잔치"]);

    expect(relationEq).toHaveBeenCalledWith("photo_id", "photo-1");
    expect(relationInsert).toHaveBeenCalledWith([
      { photo_id: "photo-1", event_id: "event-a" },
      { photo_id: "photo-1", event_id: "event-b" },
    ]);
    expect(names).toEqual(["여행", "돌잔치"]);
  });

  test("listEventNamesByPhotoIds groups event names per photo", async () => {
    const relationIn = vi.fn().mockResolvedValue({
      data: [
        { photo_id: "photo-1", event_id: "event-a" },
        { photo_id: "photo-1", event_id: "event-b" },
        { photo_id: "photo-2", event_id: "event-a" },
      ],
      error: null,
    });
    const photoEventsBuilder = {
      select: vi.fn(() => ({
        in: relationIn,
      })),
    };

    const eventsIn = vi.fn().mockResolvedValue({
      data: [
        { id: "event-a", name: "여행", normalized_name: "여행" },
        { id: "event-b", name: "돌잔치", normalized_name: "돌잔치" },
      ],
      error: null,
    });
    const eventsBuilder = {
      select: vi.fn(() => ({
        in: eventsIn,
      })),
    };

    const from = vi.fn((table: string) => {
      if (table === "gallery_photo_events") {
        return photoEventsBuilder;
      }

      if (table === "gallery_events") {
        return eventsBuilder;
      }

      throw new Error(`unexpected table ${table}`);
    });

    const mapped = await listEventNamesByPhotoIds({ from }, ["photo-1", "photo-2"]);

    expect(mapped.get("photo-1")).toEqual(["여행", "돌잔치"]);
    expect(mapped.get("photo-2")).toEqual(["여행"]);
  });

  test("listEventSuggestions sorts by usage and query prefix", async () => {
    const eventsLimit = vi.fn().mockResolvedValue({
      data: [
        { id: "event-a", name: "여행", normalized_name: "여행", updated_at: "2026-02-16T00:00:00.000Z" },
        { id: "event-b", name: "여행기", normalized_name: "여행기", updated_at: "2026-02-15T00:00:00.000Z" },
        { id: "event-c", name: "돌잔치", normalized_name: "돌잔치", updated_at: "2026-02-14T00:00:00.000Z" },
      ],
      error: null,
    });
    const eventsOrder = vi.fn(() => ({
      limit: eventsLimit,
    }));
    const eventsBuilder = {
      select: vi.fn(() => ({
        ilike: vi.fn(() => ({
          order: eventsOrder,
        })),
        order: eventsOrder,
      })),
    };

    const relationIn = vi.fn().mockResolvedValue({
      data: [
        { event_id: "event-b" },
        { event_id: "event-b" },
        { event_id: "event-a" },
      ],
      error: null,
    });
    const photoEventsBuilder = {
      select: vi.fn(() => ({
        in: relationIn,
      })),
    };

    const from = vi.fn((table: string) => {
      if (table === "gallery_events") {
        return eventsBuilder;
      }

      if (table === "gallery_photo_events") {
        return photoEventsBuilder;
      }

      throw new Error(`unexpected table ${table}`);
    });

    const suggestions = await listEventSuggestions({ from }, "여", 2);

    expect(suggestions).toEqual(["여행기", "여행"]);
  });
});
