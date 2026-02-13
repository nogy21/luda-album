import { describe, expect, test } from "vitest";

import { getInitialFeaturedImages } from "./featured";
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
