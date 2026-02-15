import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewPhotoBottomSheet } from "./new-photo-bottom-sheet";

const pushMock = vi.fn();
const lockPageScrollMock = vi.fn(() => ({
  bodyOverflow: "",
  bodyPosition: "",
  bodyTop: "",
  bodyWidth: "",
  htmlOverflow: "",
  scrollY: 0,
}));
const unlockPageScrollMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/ui/scroll-lock", () => ({
  lockPageScroll: (...args: unknown[]) => lockPageScrollMock(...args),
  unlockPageScroll: (...args: unknown[]) => unlockPageScrollMock(...args),
}));

describe("NewPhotoBottomSheet", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => {
          store.clear();
        },
      },
      configurable: true,
    });
    pushMock.mockReset();
    lockPageScrollMock.mockClear();
    unlockPageScrollMock.mockClear();
  });

  it("locks page scroll while open and unlocks on dismiss", async () => {
    render(<NewPhotoBottomSheet latestPhotoTakenAt="2026-02-12T04:00:00.000Z" />);

    await screen.findByRole("dialog", { name: "새 사진 알림" });
    await waitFor(() => {
      expect(lockPageScrollMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "나중에" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "새 사진 알림" })).not.toBeInTheDocument();
    });
    expect(unlockPageScrollMock).toHaveBeenCalledTimes(1);
  });
});
