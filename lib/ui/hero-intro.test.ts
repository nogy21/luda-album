import { describe, expect, it, vi } from "vitest";

import {
  HERO_INTRO_SESSION_KEY,
  markHeroIntroSeen,
  shouldRunHeroIntro,
} from "./hero-intro";

describe("hero intro session gate", () => {
  it("returns true when intro has not been marked yet", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    };

    expect(shouldRunHeroIntro(storage)).toBe(true);
    expect(storage.getItem).toHaveBeenCalledWith(HERO_INTRO_SESSION_KEY);
  });

  it("returns false when intro is already marked", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue("seen"),
      setItem: vi.fn(),
    };

    expect(shouldRunHeroIntro(storage)).toBe(false);
  });

  it("marks intro as seen", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    markHeroIntroSeen(storage);
    expect(storage.setItem).toHaveBeenCalledWith(HERO_INTRO_SESSION_KEY, "seen");
  });
});

