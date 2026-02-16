import type { PhotoItem } from "./types";

export type TagAlbum = {
  tag: string;
  count: number;
  cover: PhotoItem;
  items: PhotoItem[];
};

const hashtagRegex = /#([\p{L}\p{N}_-]+)/gu;

const normalizeTag = (tag: string) => {
  return tag.trim().replace(/^#+/, "").toLowerCase();
};

const titleCaseTag = (tag: string) => {
  if (tag.length === 0) {
    return tag;
  }

  return `${tag[0]?.toUpperCase() ?? ""}${tag.slice(1)}`;
};

const extractCaptionHashtags = (caption: string) => {
  return Array.from(caption.matchAll(hashtagRegex)).map((match) => match[1] ?? "");
};

export const getPhotoTags = (
  item: Pick<PhotoItem, "caption" | "tags" | "eventNames">,
): string[] => {
  const raw = [
    ...(item.eventNames ?? []),
    ...(item.tags ?? []),
    ...extractCaptionHashtags(item.caption),
  ];
  const unique = new Set<string>();

  for (const source of raw) {
    const normalized = normalizeTag(source);

    if (!normalized) {
      continue;
    }

    unique.add(titleCaseTag(normalized));
  }

  if (unique.size === 0) {
    return ["일상"];
  }

  return [...unique];
};

export const groupPhotosByTag = (items: PhotoItem[]): TagAlbum[] => {
  const map = new Map<string, PhotoItem[]>();

  for (const item of items) {
    for (const tag of getPhotoTags(item)) {
      if (!map.has(tag)) {
        map.set(tag, []);
      }

      map.get(tag)?.push(item);
    }
  }

  return [...map.entries()]
    .map(([tag, photos]) => ({
      tag,
      count: photos.length,
      cover: photos[0] as PhotoItem,
      items: photos,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.tag.localeCompare(right.tag, "ko");
    });
};
