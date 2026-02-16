/* eslint-disable @next/next/no-img-element */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingRecentSection } from "./landing-recent-section";

const lockPageScrollMock = vi.fn(() => ({
  bodyOverflow: "",
  bodyPosition: "",
  bodyTop: "",
  bodyWidth: "",
  htmlOverflow: "",
  scrollY: 0,
}));
const unlockPageScrollMock = vi.fn();

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { priority, ...rest } = props;
    void priority;
    return <img {...rest} alt={String(props.alt ?? "")} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: Record<string, unknown>) => (
    <a href={String(href ?? "#")} {...rest}>
      {children as ReactNode}
    </a>
  ),
}));

vi.mock("@/lib/ui/scroll-lock", () => ({
  lockPageScroll: (...args: unknown[]) => lockPageScrollMock(...args),
  unlockPageScroll: (...args: unknown[]) => unlockPageScrollMock(...args),
}));

const originalRequestFullscreen = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "requestFullscreen",
);
const originalExitFullscreen = Object.getOwnPropertyDescriptor(document, "exitFullscreen");
const originalFullscreenElement = Object.getOwnPropertyDescriptor(document, "fullscreenElement");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  lockPageScrollMock.mockClear();
  unlockPageScrollMock.mockClear();

  if (originalRequestFullscreen) {
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", originalRequestFullscreen);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (HTMLElement.prototype as any).requestFullscreen;
  }

  if (originalExitFullscreen) {
    Object.defineProperty(document, "exitFullscreen", originalExitFullscreen);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (document as any).exitFullscreen;
  }

  if (originalFullscreenElement) {
    Object.defineProperty(document, "fullscreenElement", originalFullscreenElement);
  }
});

const buildPhoto = (id: string) => ({
  id,
  src: `/${id}.jpg`,
  thumbSrc: null,
  alt: `${id} alt`,
  caption: `${id} caption`,
  takenAt: "2026-02-16T10:00:00.000Z",
  updatedAt: "2026-02-16T10:00:00.000Z",
  visibility: "family" as const,
  isFeatured: false,
  featuredRank: null,
});

describe("LandingRecentSection lightbox fullscreen", () => {
  it("toggles fullscreen when API is supported", async () => {
    const requestMock = vi.fn().mockResolvedValue(undefined);
    const exitMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestMock,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitMock,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => null,
    });

    render(<LandingRecentSection items={[buildPhoto("photo-1")]} />);

    fireEvent.click(screen.getByRole("button", { name: "photo-1 caption 확대 보기" }));
    fireEvent.click(screen.getByRole("button", { name: "전체화면" }));

    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to opening a new tab when fullscreen API is unavailable", () => {
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: undefined,
    });

    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<LandingRecentSection items={[buildPhoto("photo-2")]} />);

    fireEvent.click(screen.getByRole("button", { name: "photo-2 caption 확대 보기" }));
    fireEvent.click(screen.getByRole("button", { name: "새 탭으로 보기" }));

    expect(openSpy).toHaveBeenCalledWith("/photo-2.jpg", "_blank", "noopener,noreferrer");
  });
});
