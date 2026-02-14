const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const calculateDaysSince = (
  fromIso: string,
  now: Date = new Date(),
) => {
  const fromDate = new Date(fromIso);

  if (Number.isNaN(fromDate.getTime())) {
    return 1;
  }

  const diff = Math.max(0, now.getTime() - fromDate.getTime());
  return Math.floor(diff / DAY_IN_MS) + 1;
};
