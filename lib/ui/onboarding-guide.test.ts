import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ONBOARDING_PROGRESS,
  ONBOARDING_STEPS,
  markOnboardingCompleted,
  readOnboardingProgress,
  resolveStartStep,
  setOnboardingSkippedInSession,
  shouldAutoOpenOnboarding,
  getNextStep,
  writeOnboardingProgress,
} from "./onboarding-guide";

describe("onboarding guide helpers", () => {
  it("reads default progress when storage is unavailable", () => {
    expect(readOnboardingProgress(null)).toEqual(DEFAULT_ONBOARDING_PROGRESS);
  });

  it("writes and reads progress from storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
    };

    writeOnboardingProgress(storage, {
      completed: true,
      completedAt: "2026-02-17T10:20:00.000Z",
    });

    expect(readOnboardingProgress(storage)).toEqual({
      completed: true,
      completedAt: "2026-02-17T10:20:00.000Z",
    });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("marks onboarding complete with timestamp", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
    };

    markOnboardingCompleted(storage, new Date("2026-02-17T09:00:00.000Z"));

    expect(readOnboardingProgress(storage)).toEqual({
      completed: true,
      completedAt: "2026-02-17T09:00:00.000Z",
    });
  });

  it("resolves start step by pathname", () => {
    expect(resolveStartStep("/").id).toBe("home-intro");
    expect(resolveStartStep("/photos").id).toBe("photos-overview");
    expect(resolveStartStep("/photos?year=2026").id).toBe("photos-overview");
    expect(resolveStartStep("/guestbook").id).toBe("guestbook-intro");
    expect(resolveStartStep("/admin").id).toBe("home-intro");
  });

  it("returns next step and null for final step", () => {
    expect(getNextStep("home-intro")?.id).toBe("home-nav");
    expect(getNextStep("home-nav")?.id).toBe("photos-overview");
    expect(getNextStep("photos-overview")?.id).toBe("photos-gestures");
    expect(getNextStep("photos-gestures")?.id).toBe("guestbook-intro");
    expect(getNextStep("guestbook-intro")).toBeNull();
  });

  it("prevents auto-open only when completed or skipped in current session", () => {
    const localStore = new Map<string, string>();
    const localStorage = {
      getItem: vi.fn((key: string) => localStore.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStore.set(key, value);
      }),
    };
    const sessionStore = new Map<string, string>();
    const sessionStorage = {
      getItem: vi.fn((key: string) => sessionStore.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        sessionStore.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        sessionStore.delete(key);
      }),
    };

    expect(shouldAutoOpenOnboarding(localStorage, sessionStorage)).toBe(true);

    setOnboardingSkippedInSession(sessionStorage, true);
    expect(shouldAutoOpenOnboarding(localStorage, sessionStorage)).toBe(false);

    setOnboardingSkippedInSession(sessionStorage, false);
    expect(shouldAutoOpenOnboarding(localStorage, sessionStorage)).toBe(true);

    markOnboardingCompleted(localStorage, new Date("2026-02-17T09:00:00.000Z"));
    expect(shouldAutoOpenOnboarding(localStorage, sessionStorage)).toBe(false);
  });

  it("keeps the fixed step order", () => {
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([
      "home-intro",
      "home-nav",
      "photos-overview",
      "photos-gestures",
      "guestbook-intro",
    ]);
  });
});
