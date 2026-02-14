import { describe, expect, test } from "vitest";

import {
  buildPhotoDayDeepLink,
  isNewPhotoNoticeEligible,
  toLocalDateKey,
} from "./new-photo-notice";

describe("new photo notice", () => {
  test("shows when there is a newer photo and no suppression", () => {
    const now = new Date("2026-02-15T09:00:00.000Z");

    const result = isNewPhotoNoticeEligible({
      now,
      latestPhotoTakenAt: "2026-02-15T08:00:00.000Z",
      lastSeenTakenAt: "2026-02-14T08:00:00.000Z",
    });

    expect(result).toBe(true);
  });

  test("hides when already shown today", () => {
    const now = new Date("2026-02-15T09:00:00.000Z");

    const result = isNewPhotoNoticeEligible({
      now,
      latestPhotoTakenAt: "2026-02-15T08:00:00.000Z",
      shownDateKey: toLocalDateKey(now),
    });

    expect(result).toBe(false);
  });

  test("hides during snooze window", () => {
    const now = new Date("2026-02-15T09:00:00.000Z");

    const result = isNewPhotoNoticeEligible({
      now,
      latestPhotoTakenAt: "2026-02-15T08:00:00.000Z",
      snoozedUntilIso: "2026-02-15T15:00:00.000Z",
    });

    expect(result).toBe(false);
  });

  test("builds deep link to day album", () => {
    expect(buildPhotoDayDeepLink("2026-02-15T08:00:00.000Z")).toBe("/photos?year=2026&month=2&day=15");
  });
});
