import { describe, expect, test } from "vitest";

import { groupGalleryImagesByMonth } from "./grouping";
import type { GalleryImage } from "./images";

describe("groupGalleryImagesByMonth", () => {
  test("groups photos by month and sorts groups newest first", () => {
    const input: GalleryImage[] = [
      {
        id: "a",
        src: "/a.jpg",
        alt: "a",
        caption: "a",
        takenAt: "2026-01-10T10:00:00.000Z",
      },
      {
        id: "b",
        src: "/b.jpg",
        alt: "b",
        caption: "b",
        takenAt: "2026-02-11T10:00:00.000Z",
      },
      {
        id: "c",
        src: "/c.jpg",
        alt: "c",
        caption: "c",
        takenAt: "2026-02-09T10:00:00.000Z",
      },
    ];

    const grouped = groupGalleryImagesByMonth(input);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].key).toBe("2026-02");
    expect(grouped[0].items.map((item) => item.id)).toEqual(["b", "c"]);
    expect(grouped[0].latestTakenAt).toBe("2026-02-11T10:00:00.000Z");
    expect(grouped[0].updatedLabel).toBe("2월 11일 업데이트");
    expect(grouped[1].key).toBe("2026-01");
    expect(grouped[1].items.map((item) => item.id)).toEqual(["a"]);
    expect(grouped[1].latestTakenAt).toBe("2026-01-10T10:00:00.000Z");
    expect(grouped[1].updatedLabel).toBe("1월 10일 업데이트");
  });

  test("returns Korean month labels", () => {
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
  });
});
