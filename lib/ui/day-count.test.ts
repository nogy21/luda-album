import { describe, expect, test } from "vitest";

import { calculateDaysSince } from "./day-count";

describe("calculateDaysSince", () => {
  test("counts inclusive day number from birth date", () => {
    const result = calculateDaysSince("2025-10-22T00:00:00.000Z", new Date("2025-10-22T12:00:00.000Z"));

    expect(result).toBe(1);
  });

  test("increases as days pass", () => {
    const result = calculateDaysSince("2025-10-22T00:00:00.000Z", new Date("2025-10-25T12:00:00.000Z"));

    expect(result).toBe(4);
  });
});
