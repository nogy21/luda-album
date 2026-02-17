export const ONBOARDING_PROGRESS_KEY = "luda:onboarding-guide:progress:v1";
export const ONBOARDING_SESSION_SKIP_KEY = "luda:onboarding-guide:skip-session:v1";

export type OnboardingStepId =
  | "home-intro"
  | "home-nav"
  | "photos-overview"
  | "photos-gestures"
  | "guestbook-intro";

export type OnboardingStep = {
  id: OnboardingStepId;
  route: "/" | "/photos" | "/guestbook";
  title: string;
  description: string;
};

export type OnboardingProgress = {
  completed: boolean;
  completedAt: string | null;
};

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;
type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "home-intro",
    route: "/",
    title: "루다 앨범에 오신 걸 환영해요",
    description: "홈에서는 최근 사진과 빠른 기능을 먼저 볼 수 있어요.",
  },
  {
    id: "home-nav",
    route: "/",
    title: "아래 메뉴로 이동해요",
    description: "하단 메뉴의 홈, 앨범, 덕담 탭으로 화면을 쉽게 바꿀 수 있어요.",
  },
  {
    id: "photos-overview",
    route: "/photos",
    title: "앨범은 월별로 정리돼요",
    description: "사진을 누르면 크게 보고, 스크롤하면 다음 달 사진이 이어져요.",
  },
  {
    id: "photos-gestures",
    route: "/photos",
    title: "큰 사진 화면 제스처",
    description: "좌우 스와이프, 더블탭 확대, 핀치로 확대/축소를 사용할 수 있어요.",
  },
  {
    id: "guestbook-intro",
    route: "/guestbook",
    title: "덕담을 남겨주세요",
    description: "짧은 한 줄도 좋아요. 닉네임 없이도 남길 수 있어요.",
  },
];

export const DEFAULT_ONBOARDING_PROGRESS: OnboardingProgress = {
  completed: false,
  completedAt: null,
};

const normalizePathname = (pathname: string) => {
  const [withoutQuery] = pathname.split("?");
  const [withoutHash] = withoutQuery.split("#");

  if (!withoutHash) {
    return "/";
  }

  return withoutHash.startsWith("/") ? withoutHash : `/${withoutHash}`;
};

const isProgressLike = (value: unknown): value is OnboardingProgress => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybe = value as Partial<OnboardingProgress>;

  return (
    typeof maybe.completed === "boolean" &&
    (typeof maybe.completedAt === "string" || maybe.completedAt === null)
  );
};

export function readOnboardingProgress(storage: ReadStorage | null): OnboardingProgress {
  if (!storage) {
    return DEFAULT_ONBOARDING_PROGRESS;
  }

  try {
    const raw = storage.getItem(ONBOARDING_PROGRESS_KEY);

    if (!raw) {
      return DEFAULT_ONBOARDING_PROGRESS;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!isProgressLike(parsed)) {
      return DEFAULT_ONBOARDING_PROGRESS;
    }

    return parsed;
  } catch {
    return DEFAULT_ONBOARDING_PROGRESS;
  }
}

export function writeOnboardingProgress(
  storage: WriteStorage | null,
  progress: OnboardingProgress,
): void {
  if (!storage) {
    return;
  }

  storage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress));
}

export function markOnboardingCompleted(
  storage: WriteStorage | null,
  now: Date = new Date(),
): void {
  writeOnboardingProgress(storage, {
    completed: true,
    completedAt: now.toISOString(),
  });
}

export function resolveStartStep(pathname: string): OnboardingStep {
  const normalized = normalizePathname(pathname);

  if (normalized.startsWith("/photos")) {
    return ONBOARDING_STEPS.find((step) => step.id === "photos-overview") ?? ONBOARDING_STEPS[0];
  }

  if (normalized.startsWith("/guestbook")) {
    return ONBOARDING_STEPS.find((step) => step.id === "guestbook-intro") ?? ONBOARDING_STEPS[0];
  }

  return ONBOARDING_STEPS[0];
}

export function getNextStep(stepId: OnboardingStepId): OnboardingStep | null {
  const currentIndex = ONBOARDING_STEPS.findIndex((step) => step.id === stepId);

  if (currentIndex < 0) {
    return null;
  }

  return ONBOARDING_STEPS[currentIndex + 1] ?? null;
}

export function getPreviousStep(stepId: OnboardingStepId): OnboardingStep | null {
  const currentIndex = ONBOARDING_STEPS.findIndex((step) => step.id === stepId);

  if (currentIndex <= 0) {
    return null;
  }

  return ONBOARDING_STEPS[currentIndex - 1] ?? null;
}

export function setOnboardingSkippedInSession(
  storage: SessionStorageLike | null,
  skipped: boolean,
): void {
  if (!storage) {
    return;
  }

  if (skipped) {
    storage.setItem(ONBOARDING_SESSION_SKIP_KEY, "true");
    return;
  }

  storage.removeItem(ONBOARDING_SESSION_SKIP_KEY);
}

export function hasOnboardingSkippedInSession(storage: ReadStorage | null): boolean {
  if (!storage) {
    return false;
  }

  return storage.getItem(ONBOARDING_SESSION_SKIP_KEY) === "true";
}

export function shouldAutoOpenOnboarding(
  localStorage: ReadStorage | null,
  sessionStorage: ReadStorage | null,
): boolean {
  const progress = readOnboardingProgress(localStorage);

  if (progress.completed) {
    return false;
  }

  return !hasOnboardingSkippedInSession(sessionStorage);
}
