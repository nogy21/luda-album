import { describe, expect, test } from "vitest";

import { getPhotoTags, groupPhotosByTag } from "./tags";
import type { PhotoItem } from "./types";

const createPhoto = (id: string, caption: string, tags?: string[]): PhotoItem => ({
  id,
  src: `/${id}.jpg`,
  thumbSrc: null,
  alt: id,
  caption,
  takenAt: "2026-02-14T10:00:00.000Z",
  updatedAt: "2026-02-14T10:00:00.000Z",
  visibility: "family",
  isFeatured: false,
  featuredRank: null,
  tags,
});

describe("gallery tags", () => {
  test("extracts and deduplicates explicit tags and hashtag caption tags", () => {
    const tags = getPhotoTags(createPhoto("p1", "오늘도 #웃음 #산책", ["웃음", "일상"]));

    expect(tags).toEqual(["웃음", "일상", "산책"]);
  });

  test("groups photos into tag albums sorted by size", () => {
    const albums = groupPhotosByTag([
      createPhoto("p1", "#웃음", ["웃음"]),
      createPhoto("p2", "#웃음", ["웃음"]),
      createPhoto("p3", "#가족", ["가족"]),
    ]);

    expect(albums[0]).toMatchObject({
      tag: "웃음",
      count: 2,
    });
    expect(albums[1]).toMatchObject({
      tag: "가족",
      count: 1,
    });
  });
});
