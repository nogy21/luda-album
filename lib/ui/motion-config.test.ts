import { describe, expect, it } from "vitest";

import { buildSoftRevealTransition } from "./motion-config";

describe("motion config", () => {
  it("returns zero-duration transition for reduced motion", () => {
    const transition = buildSoftRevealTransition(true, 0.2);

    expect(transition.duration).toBe(0);
    expect(transition.delay).toBe(0);
  });

  it("returns eased transition with provided delay", () => {
    const transition = buildSoftRevealTransition(false, 0.24);

    expect(transition.delay).toBe(0.24);
    expect(transition.duration).toBeGreaterThan(0);
    expect(transition.ease).toEqual([0.22, 1, 0.36, 1]);
  });
});
