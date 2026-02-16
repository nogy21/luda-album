import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/fixed-bottom-nav", () => ({
  FixedBottomNav: () => <nav data-testid="bottom-nav" />,
}));

vi.mock("@/components/landing-guestbook-cta", () => ({
  LandingGuestbookCta: () => <section data-testid="guestbook-cta" />,
}));

vi.mock("@/components/landing-hero", () => ({
  LandingHero: () => <section data-testid="landing-hero" />,
}));

vi.mock("@/components/landing-recent-section", () => ({
  LandingRecentSection: () => <section data-testid="landing-recent" />,
}));

vi.mock("@/components/luda-day-banner", () => ({
  LudaDayBanner: () => <section data-testid="day-banner" />,
}));

vi.mock("@/components/new-photo-bottom-sheet", () => ({
  NewPhotoBottomSheet: () => <section data-testid="new-photo-sheet" />,
}));

vi.mock("@/components/push-notification-panel", () => ({
  PushNotificationPanel: () => <section data-testid="push-panel" />,
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children?: unknown }) => <div data-testid="app-shell">{children as ReactNode}</div>,
}));

vi.mock("@/components/gallery-section", () => ({
  GallerySection: () => <section data-testid="gallery-section" />,
}));

vi.mock("@/lib/gallery/repository", () => ({
  listPhotosPageFromDatabase: vi.fn(),
  listPhotoSummaryFromDatabase: vi.fn(),
  listPhotosMonthPageFromDatabase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => null,
}));

afterEach(() => {
  cleanup();
});

describe("push panel exposure policy", () => {
  it("shows push panel on home and hides it on photos", async () => {
    const home = (await import("./page")).default;
    render(await home());

    expect(screen.getByTestId("push-panel")).toBeInTheDocument();

    cleanup();

    const photos = (await import("./photos/page")).default;
    render(await photos());

    expect(screen.queryByTestId("push-panel")).not.toBeInTheDocument();
  });
});
