/* eslint-disable @next/next/no-img-element */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LandingHero } from "./landing-hero";

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

vi.mock("gsap", () => ({
  default: {
    context: (callback: () => void) => {
      callback();
      return { revert: () => {} };
    },
    fromTo: () => {},
  },
}));

vi.mock("@/lib/ui/hero-intro", () => ({
  LANDING_INTRO_SESSION_KEY: "landing-intro",
  shouldRunHeroIntro: () => false,
  markHeroIntroSeen: () => {},
}));

const buildPhoto = (id: string) => ({
  id,
  src: `/${id}.jpg`,
  thumbSrc: null,
  alt: `${id} alt`,
  caption: `${id} caption`,
  takenAt: "2026-02-16T10:00:00.000Z",
  updatedAt: "2026-02-16T10:00:00.000Z",
  visibility: "family" as const,
  isFeatured: true,
  featuredRank: 1,
});

describe("LandingHero", () => {
  it("renders fixed copy as 루다 하이라이트", () => {
    render(<LandingHero items={[buildPhoto("photo-1")]} />);

    expect(
      screen.getByRole("heading", { name: "루다 하이라이트" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("루다 하이라이트")).toBeInTheDocument();
    expect(screen.queryByText("오늘의 루다 하이라이트")).not.toBeInTheDocument();
  });
});
