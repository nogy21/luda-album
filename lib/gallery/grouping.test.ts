import { describe, expect, test } from "vitest";

import { groupGalleryImagesByMonth } from "./grouping";
import type { GalleryImage } from "./images";

describe("groupGalleryImagesByMonth", () => {
  test("groups photos by month and builds month metadata", () => {
    const input: GalleryImage[] = [
      {
        id: "a",
        src: "/a.jpg",
        alt: "a",
        caption: "a",
        takenAt: "2026-01-10T10:00:00.000Z",
        updatedAt: "2026-01-10T10:00:00.000Z",
      },
      {
        id: "b",
        src: "/b.jpg",
        alt: "b",
        caption: "b",
        takenAt: "2026-02-11T10:00:00.000Z",
        updatedAt: "2026-02-12T10:00:00.000Z",
      },
      {
        id: "c",
        src: "/c.jpg",
        alt: "c",
        caption: "c",
        takenAt: "2026-02-09T10:00:00.000Z",
        updatedAt: "2026-02-09T10:00:00.000Z",
      },
    ];

    const grouped = groupGalleryImagesByMonth(input);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].key).toBe("2026-02");
    expect(grouped[0].items.map((item) => item.id)).toEqual(["b", "c"]);
    expect(grouped[0].latestTakenAt).toBe("2026-02-11T10:00:00.000Z");
    expect(grouped[0].latestUpdatedAt).toBe("2026-02-12T10:00:00.000Z");
    expect(grouped[0].updatedLabel.startsWith("최근 업데이트")).toBe(true);
    expect(grouped[0].metaLabel).toContain("2026년 2월");
    expect(grouped[0].metaLabel).toContain("사진 2장");

    expect(grouped[1].key).toBe("2026-01");
    expect(grouped[1].items.map((item) => item.id)).toEqual(["a"]);
    expect(grouped[1].metaLabel).toContain("사진 1장");
  });

  test("returns Korean month labels and year/month fields", () => {
    const input: GalleryImage[] = [
      {
        id: "a",
        src: "/a.jpg",
        alt: "a",
        caption: "a",
        takenAt: "2026-02-10T10:00:00.000Z",
      },
    ];

    const grouped = groupGalleryImagesByMonth(input);

    expect(grouped[0].label).toBe("2026년 2월");
    expect(grouped[0].year).toBe(2026);
    expect(grouped[0].month).toBe(2);
  });
});
