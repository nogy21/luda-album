import { describe, expect, test } from "vitest";

import {
  normalizeEventName,
  parseEventNamesPayload,
  sanitizeEventNames,
} from "./event-names";

describe("event names", () => {
  test("normalizeEventName trims and lowercases", () => {
    expect(normalizeEventName("  Family   Trip ")).toBe("family trip");
  });

  test("sanitizeEventNames removes duplicates and invalid values", () => {
    expect(
      sanitizeEventNames([
        " 여행 ",
        "여행",
        "",
        "  ",
        "가".repeat(31),
        "돌잔치",
      ]),
    ).toEqual(["여행", "돌잔치"]);
  });

  test("parseEventNamesPayload validates array input", () => {
    expect(parseEventNamesPayload(undefined)).toEqual({ eventNames: undefined });
    expect(parseEventNamesPayload(["여행", " 돌잔치 "])).toEqual({
      eventNames: ["여행", "돌잔치"],
    });

    const invalid = parseEventNamesPayload([""]);
    expect("error" in invalid ? invalid.error : "").toContain("비워둘 수 없어요");
  });
});
