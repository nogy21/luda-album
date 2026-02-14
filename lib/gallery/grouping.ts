import { formatMonthMetaLabel, formatRelativeDaysFromNow } from "./time";
import type { GalleryImage } from "./images";

export type GalleryMonthGroup = {
  key: string;
  label: string;
  year: number;
  month: number;
  latestTakenAt: string;
  latestUpdatedAt: string;
  updatedLabel: string;
  metaLabel: string;
  items: GalleryImage[];
};

const getMonthData = (takenAt: string) => {
  const date = new Date(takenAt);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    label: `${year}년 ${month}월`,
    year,
    month,
  };
};

const sortByTakenAtDesc = (left: GalleryImage, right: GalleryImage) => {
  return +new Date(right.takenAt) - +new Date(left.takenAt);
};

export const groupGalleryImagesByMonth = (images: GalleryImage[]): GalleryMonthGroup[] => {
  const sorted = [...images].sort(sortByTakenAtDesc);
  const groups = new Map<string, GalleryMonthGroup>();

  for (const image of sorted) {
    const monthData = getMonthData(image.takenAt);

    if (!groups.has(monthData.key)) {
      const updatedAt = image.updatedAt ?? image.takenAt;
      groups.set(monthData.key, {
        key: monthData.key,
        label: monthData.label,
        year: monthData.year,
        month: monthData.month,
        latestTakenAt: image.takenAt,
        latestUpdatedAt: updatedAt,
        updatedLabel:
          formatRelativeDaysFromNow(updatedAt) === "오늘"
            ? "최근 업데이트 오늘"
            : `최근 업데이트 ${formatRelativeDaysFromNow(updatedAt)}`,
        metaLabel: formatMonthMetaLabel(
          monthData.year,
          monthData.month,
          1,
          updatedAt,
        ),
        items: [],
      });
    }

    const group = groups.get(monthData.key);

    if (!group) {
      continue;
    }

    group.items.push(image);

    if (+new Date(image.takenAt) > +new Date(group.latestTakenAt)) {
      group.latestTakenAt = image.takenAt;
    }

    const imageUpdatedAt = image.updatedAt ?? image.takenAt;

    if (+new Date(imageUpdatedAt) > +new Date(group.latestUpdatedAt)) {
      group.latestUpdatedAt = imageUpdatedAt;
    }

    group.updatedLabel =
      formatRelativeDaysFromNow(group.latestUpdatedAt) === "오늘"
        ? "최근 업데이트 오늘"
        : `최근 업데이트 ${formatRelativeDaysFromNow(group.latestUpdatedAt)}`;

    group.metaLabel = formatMonthMetaLabel(
      group.year,
      group.month,
      group.items.length,
      group.latestUpdatedAt,
    );
  }

  return [...groups.values()].sort((left, right) => {
    return +new Date(right.latestTakenAt) - +new Date(left.latestTakenAt);
  });
};
