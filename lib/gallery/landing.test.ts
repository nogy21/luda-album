import { describe, expect, test } from "vitest";

import { pickRandomPastDailyMemory } from "./landing";
import type { PhotoItem } from "./types";

const createPhoto = (id: string, takenAt: string): PhotoItem => ({
  id,
  src: `/${id}.jpg`,
  thumbSrc: null,
  alt: id,
  caption: id,
  takenAt,
  updatedAt: takenAt,
  visibility: "family",
  isFeatured: false,
  featuredRank: null,
});

describe("pickRandomPastDailyMemory", () => {
  test("returns null when no past day exists", () => {
    const items = [createPhoto("today", "2026-02-14T10:00:00.000Z")];

    const result = pickRandomPastDailyMemory(items, new Date("2026-02-14T12:00:00.000Z"));

    expect(result).toBeNull();
  });

  test("picks one past day deterministically and caps photos to three", () => {
    const items = [
      createPhoto("today", "2026-02-14T10:00:00.000Z"),
      createPhoto("past-a", "2026-02-12T11:00:00.000Z"),
      createPhoto("past-b", "2026-02-12T10:00:00.000Z"),
      createPhoto("past-c", "2026-02-12T09:00:00.000Z"),
      createPhoto("past-d", "2026-02-12T08:00:00.000Z"),
      createPhoto("older", "2026-02-10T08:00:00.000Z"),
    ];

    const result = pickRandomPastDailyMemory(items, new Date("2026-02-14T12:00:00.000Z"));

    expect(result).not.toBeNull();
    expect(result?.dateKey).toMatch(/^2026-02-(12|10)$/);
    expect(result?.items.length).toBeLessThanOrEqual(3);
  });
});
