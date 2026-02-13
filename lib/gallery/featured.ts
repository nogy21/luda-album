import type { GalleryImage } from "./images";

const sortByTakenAtDesc = (left: GalleryImage, right: GalleryImage) => {
  return +new Date(right.takenAt) - +new Date(left.takenAt);
};

const dedupeBySrc = (images: GalleryImage[]) => {
  return Array.from(new Map(images.map((item) => [item.src, item])).values());
};

export const getInitialFeaturedImages = (
  images: GalleryImage[],
  maxCount: number = 5,
) => {
  return dedupeBySrc(images).sort(sortByTakenAtDesc).slice(0, maxCount);
};

export const getShuffledFeaturedImages = (
  images: GalleryImage[],
  maxCount: number = 5,
  random: () => number = Math.random,
) => {
  const deduped = dedupeBySrc(images);

  for (let index = deduped.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = deduped[index];

    deduped[index] = deduped[swapIndex];
    deduped[swapIndex] = current;
  }

  return deduped.slice(0, maxCount);
};
