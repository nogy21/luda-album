import { describe, expect, test } from "vitest";

import { getInitialFeaturedImages, getLatestDateItems, getRandomDateItems } from "./featured";
import { galleryImages } from "./images";

describe("getInitialFeaturedImages", () => {
  test("returns a deterministic set for initial render", () => {
    const first = getInitialFeaturedImages(galleryImages);
    const second = getInitialFeaturedImages(galleryImages);

    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
  });

  test("returns unique images by src and respects max count", () => {
    const featured = getInitialFeaturedImages(galleryImages, 5);
    const srcSet = new Set(featured.map((item) => item.src));

    expect(featured.length).toBeLessThanOrEqual(5);
    expect(srcSet.size).toBe(featured.length);
  });
});

describe("getLatestDateItems", () => {
  test("returns up to max items from the latest date", () => {
    const items = [
      { id: "a", takenAt: "2026-02-09T11:00:00.000Z" },
      { id: "b", takenAt: "2026-02-10T10:00:00.000Z" },
      { id: "c", takenAt: "2026-02-10T08:00:00.000Z" },
      { id: "d", takenAt: "2026-02-10T07:00:00.000Z" },
      { id: "e", takenAt: "2026-02-08T06:00:00.000Z" },
    ];

    const latest = getLatestDateItems(items, 2);

    expect(latest.map((item) => item.id)).toEqual(["b", "c"]);
  });
});

describe("getRandomDateItems", () => {
  test("returns a random date group and respects max count", () => {
    const items = [
      { id: "first-1", takenAt: "2026-02-12T10:00:00.000Z" },
      { id: "first-2", takenAt: "2026-02-12T09:00:00.000Z" },
      { id: "second-1", takenAt: "2026-02-11T10:00:00.000Z" },
      { id: "second-2", takenAt: "2026-02-11T09:00:00.000Z" },
      { id: "third-1", takenAt: "2026-02-10T10:00:00.000Z" },
    ];

    const selected = getRandomDateItems(items, 3, () => 0.5);

    expect(selected.map((item) => item.id)).toEqual(["second-1", "second-2"]);
  });

  test("returns empty list for empty source", () => {
    expect(getRandomDateItems([], 3, () => 0)).toEqual([]);
  });
});
