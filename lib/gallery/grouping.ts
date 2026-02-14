import type { GalleryImage } from "./images";

export type GalleryMonthGroup = {
  key: string;
  label: string;
  latestTakenAt: string;
  updatedLabel: string;
  items: GalleryImage[];
};

const getMonthKey = (takenAt: string) => {
  const date = new Date(takenAt);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
};

const getMonthLabel = (takenAt: string) => {
  const date = new Date(takenAt);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
};

const getUpdatedLabel = (takenAt: string) => {
  const date = new Date(takenAt);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 업데이트`;
};

export const groupGalleryImagesByMonth = (images: GalleryImage[]): GalleryMonthGroup[] => {
  const sorted = [...images].sort((a, b) => +new Date(b.takenAt) - +new Date(a.takenAt));
  const groups = new Map<string, GalleryMonthGroup>();

  for (const image of sorted) {
    const key = getMonthKey(image.takenAt);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: getMonthLabel(image.takenAt),
        latestTakenAt: image.takenAt,
        updatedLabel: getUpdatedLabel(image.takenAt),
        items: [],
      });
    }

    groups.get(key)?.items.push(image);
  }

  return [...groups.values()];
};
