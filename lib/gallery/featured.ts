import type { GalleryImage } from "./images";

type TakenAtItem = {
  takenAt: string;
};

const sortByTakenAtDesc = (left: GalleryImage, right: GalleryImage) => {
  return +new Date(right.takenAt) - +new Date(left.takenAt);
};

const sortByTakenAtDescGeneric = <T extends TakenAtItem>(left: T, right: T) => {
  return +new Date(right.takenAt) - +new Date(left.takenAt);
};

const dedupeBySrc = (images: GalleryImage[]) => {
  return Array.from(new Map(images.map((item) => [item.src, item])).values());
};

const buildDateKey = (takenAt: string) => {
  const date = new Date(takenAt);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
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

export const getLatestDateItems = <T extends TakenAtItem>(
  items: T[],
  maxCount: number = 3,
): T[] => {
  if (items.length === 0) {
    return [];
  }

  const sorted = [...items].sort(sortByTakenAtDescGeneric);
  const latestDateKey = buildDateKey(sorted[0]!.takenAt);
  const normalizedMaxCount = Math.max(1, maxCount);

  return sorted.filter((item) => buildDateKey(item.takenAt) === latestDateKey).slice(0, normalizedMaxCount);
};

export const getRandomDateItems = <T extends TakenAtItem>(
  items: T[],
  maxCount: number = 3,
  random: () => number = Math.random,
): T[] => {
  if (items.length === 0) {
    return [];
  }

  const grouped = new Map<string, T[]>();

  for (const item of [...items].sort(sortByTakenAtDescGeneric)) {
    const dateKey = buildDateKey(item.takenAt);

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }

    grouped.get(dateKey)?.push(item);
  }

  const groups = [...grouped.values()];
  const normalizedMaxCount = Math.max(1, maxCount);
  const randomGroupIndex = Math.min(
    groups.length - 1,
    Math.floor(Math.max(0, random()) * groups.length),
  );

  return (groups[randomGroupIndex] ?? []).slice(0, normalizedMaxCount);
};
