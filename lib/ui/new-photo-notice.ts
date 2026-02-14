type NewPhotoNoticeOptions = {
  now?: Date;
  latestPhotoTakenAt?: string | null;
  lastSeenTakenAt?: string | null;
  shownDateKey?: string | null;
  snoozedUntilIso?: string | null;
};

export const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const buildPhotoDayDeepLink = (takenAtIso: string) => {
  const date = new Date(takenAtIso);

  if (Number.isNaN(date.getTime())) {
    return "/photos";
  }

  return `/photos?year=${date.getUTCFullYear()}&month=${date.getUTCMonth() + 1}&day=${date.getUTCDate()}`;
};

export const buildDismissSnoozeUntil = (now: Date) => {
  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
};

export const isNewPhotoNoticeEligible = ({
  now = new Date(),
  latestPhotoTakenAt,
  lastSeenTakenAt,
  shownDateKey,
  snoozedUntilIso,
}: NewPhotoNoticeOptions) => {
  if (!latestPhotoTakenAt) {
    return false;
  }

  const latest = new Date(latestPhotoTakenAt);

  if (Number.isNaN(latest.getTime())) {
    return false;
  }

  if (lastSeenTakenAt) {
    const lastSeen = new Date(lastSeenTakenAt);

    if (!Number.isNaN(lastSeen.getTime()) && latest.getTime() <= lastSeen.getTime()) {
      return false;
    }
  }

  if (shownDateKey && shownDateKey === toLocalDateKey(now)) {
    return false;
  }

  if (snoozedUntilIso) {
    const snoozedUntil = new Date(snoozedUntilIso);

    if (!Number.isNaN(snoozedUntil.getTime()) && now.getTime() < snoozedUntil.getTime()) {
      return false;
    }
  }

  return true;
};
