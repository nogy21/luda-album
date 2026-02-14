import type { PhotoItem } from "./types";

export type DailyMemory = {
  dateKey: string;
  label: string;
  items: PhotoItem[];
};

const toDateKey = (iso: string) => {
  return iso.slice(0, 10);
};

const formatDateLabel = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map((value) => Number.parseInt(value, 10));

  if (!year || !month || !day) {
    return dateKey;
  }

  return `${year}년 ${month}월 ${day}일`;
};

const sortByTakenAtDesc = (left: PhotoItem, right: PhotoItem) => {
  return +new Date(right.takenAt) - +new Date(left.takenAt);
};

const seedFromDate = (source: string) => {
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return hash;
};

export const pickRandomPastDailyMemory = (
  items: PhotoItem[],
  now: Date = new Date(),
): DailyMemory | null => {
  const nowKey = now.toISOString().slice(0, 10);
  const byDate = new Map<string, PhotoItem[]>();

  for (const item of [...items].sort(sortByTakenAtDesc)) {
    const key = toDateKey(item.takenAt);

    if (!byDate.has(key)) {
      byDate.set(key, []);
    }

    byDate.get(key)?.push(item);
  }

  const candidates = [...byDate.entries()].filter(([dateKey]) => dateKey < nowKey);

  if (candidates.length === 0) {
    return null;
  }

  const index = seedFromDate(nowKey) % candidates.length;
  const [dateKey, photos] = candidates[index] as [string, PhotoItem[]];

  return {
    dateKey,
    label: formatDateLabel(dateKey),
    items: photos.slice(0, 3),
  };
};
