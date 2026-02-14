export type GalleryImage = {
  id: string;
  src: string;
  thumbSrc?: string | null;
  alt: string;
  caption: string;
  tags?: string[];
  takenAt: string;
  updatedAt?: string;
  visibility?: "family" | "admin";
  isFeatured?: boolean;
  featuredRank?: number | null;
};

export const galleryImages: GalleryImage[] = [
  {
    id: "hero",
    src: "/luda.jpg",
    alt: "한복을 입은 루다",
    caption: "첫 설날 인사",
    tags: ["설날", "한복", "가족"],
    takenAt: "2026-02-12T10:30:00.000Z",
  },
  {
    id: "smile-1",
    src: "/20260208_153542.jpg",
    alt: "미소 짓는 루다",
    caption: "방긋 웃음",
    tags: ["웃음", "일상"],
    takenAt: "2026-02-08T15:35:42.000Z",
  },
  {
    id: "smile-2",
    src: "/20260208_173840.jpg",
    alt: "카메라를 보는 루다",
    caption: "또렷한 눈맞춤",
    tags: ["일상", "클로즈업"],
    takenAt: "2026-02-08T17:38:40.000Z",
  },
  {
    id: "smile-3",
    src: "/20260208_173841.jpg",
    alt: "볼이 통통한 루다",
    caption: "통통 볼살",
    tags: ["클로즈업", "일상"],
    takenAt: "2026-02-08T17:38:41.000Z",
  },
  {
    id: "smile-4",
    src: "/20260208_173842.jpg",
    alt: "누워서 쉬는 루다",
    caption: "포근한 오후",
    tags: ["휴식", "일상"],
    takenAt: "2026-02-08T17:38:42.000Z",
  },
  {
    id: "smile-5",
    src: "/20260208_173843.jpg",
    alt: "고개를 돌린 루다",
    caption: "호기심 가득",
    tags: ["일상", "표정"],
    takenAt: "2026-02-08T17:38:43.000Z",
  },
  {
    id: "smile-6",
    src: "/20260208_173853.jpg",
    alt: "웃고 있는 루다 얼굴",
    caption: "행복한 표정",
    tags: ["웃음", "표정"],
    takenAt: "2026-02-08T17:38:53.000Z",
  },
  {
    id: "memory-1",
    src: "/luda.jpg",
    alt: "가까이서 본 루다",
    caption: "복주머니와 함께",
    tags: ["설날", "가족"],
    takenAt: "2026-01-28T10:10:00.000Z",
  },
  {
    id: "memory-2",
    src: "/20260208_173842.jpg",
    alt: "잠시 쉬는 루다 모습",
    caption: "낮잠 전 찰나",
    tags: ["휴식", "일상"],
    takenAt: "2026-01-10T09:30:00.000Z",
  },
  {
    id: "memory-3",
    src: "/20260208_173853.jpg",
    alt: "밝게 웃는 루다",
    caption: "오늘의 베스트 컷",
    tags: ["웃음", "베스트"],
    takenAt: "2025-12-24T11:20:00.000Z",
  },
];
