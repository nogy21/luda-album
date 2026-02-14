export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const formatRelativeDaysFromNow = (
  isoDate: string,
  now: Date = new Date(),
): string => {
  const target = new Date(isoDate);

  if (Number.isNaN(target.getTime())) {
    return "최근";
  }

  const diffMs = Math.max(0, now.getTime() - target.getTime());
  const diffDays = Math.floor(diffMs / DAY_IN_MS);

  if (diffDays <= 0) {
    return "오늘";
  }

  return `${diffDays}일 전`;
};

export const formatYearMonthLabel = (year: number, month: number): string => {
  return `${year}년 ${month}월`;
};

export const formatMonthMetaLabel = (
  year: number,
  month: number,
  count: number,
  updatedAtIso: string,
  now: Date = new Date(),
): string => {
  const updatedLabel = formatRelativeDaysFromNow(updatedAtIso, now);

  if (updatedLabel === "오늘") {
    return `${formatYearMonthLabel(year, month)} · 사진 ${count}장 · 최근 업데이트 오늘`;
  }

  return `${formatYearMonthLabel(year, month)} · 사진 ${count}장 · 최근 업데이트 ${updatedLabel}`;
};
