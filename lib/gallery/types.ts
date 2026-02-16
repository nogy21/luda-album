export type PhotoVisibility = "family" | "admin";

export type PhotoItem = {
  id: string;
  src: string;
  thumbSrc: string | null;
  alt: string;
  caption: string;
  tags?: string[];
  takenAt: string;
  updatedAt: string;
  visibility: PhotoVisibility;
  isFeatured: boolean;
  featuredRank: number | null;
};

export type YearMonthStat = {
  key: string;
  year: number;
  month: number;
  count: number;
  latestTakenAt: string;
  latestUpdatedAt: string;
  label: string;
  updatedLabel: string;
  metaLabel: string;
};

export type PhotoListResponse = {
  items: PhotoItem[];
  nextCursor: string | null;
  summary: {
    totalCount: number;
    yearMonthStats: YearMonthStat[];
  };
};

export type HighlightResponse = {
  featured: PhotoItem[];
  highlights: PhotoItem[];
};

export type PhotoSummaryResponse = {
  totalCount: number;
  months: YearMonthStat[];
};

export type PhotoMonthPageResponse = {
  year: number;
  month: number;
  key: string;
  items: PhotoItem[];
  nextCursor: string | null;
};

export type MonthBucketState = {
  items: PhotoItem[];
  nextCursor: string | null;
  isLoading: boolean;
  isHydrated: boolean;
  hasError: string | null;
};
