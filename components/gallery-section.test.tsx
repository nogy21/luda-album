/* eslint-disable @next/next/no-img-element */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { GallerySection } from "./gallery-section";

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

beforeAll(() => {
  class MockIntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];

    observe() {}

    unobserve() {}

    disconnect() {}

    takeRecords() {
      return [];
    }
  }

  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });
});

afterEach(() => {
  cleanup();
});

const initialSummary = {
  totalCount: 2,
  months: [
    {
      key: "2026-02",
      year: 2026,
      month: 2,
      count: 2,
      latestTakenAt: "2026-02-16T08:00:00.000Z",
      latestUpdatedAt: "2026-02-16T08:00:00.000Z",
      label: "2026년 2월",
      updatedLabel: "2026년 2월",
      metaLabel: "총 2장",
    },
  ],
};

const initialMonthPages = {
  "2026-02": {
    year: 2026,
    month: 2,
    key: "2026-02",
    nextCursor: null,
    items: [
      {
        id: "photo-1",
        src: "/photo-1.jpg",
        thumbSrc: null,
        alt: "photo 1",
        caption: "photo 1",
        eventNames: [],
        takenAt: "2026-02-16T08:00:00.000Z",
        updatedAt: "2026-02-16T08:00:00.000Z",
        visibility: "family" as const,
        isFeatured: false,
        featuredRank: null,
      },
      {
        id: "photo-2",
        src: "/photo-2.jpg",
        thumbSrc: null,
        alt: "photo 2",
        caption: "photo 2",
        eventNames: [],
        takenAt: "2026-02-15T08:00:00.000Z",
        updatedAt: "2026-02-15T08:00:00.000Z",
        visibility: "family" as const,
        isFeatured: false,
        featuredRank: null,
      },
    ],
  },
};

describe("GallerySection", () => {
  it("renders timeline-only structure without removed sections", () => {
    render(
      <GallerySection
        initialSummary={initialSummary}
        initialMonthPages={initialMonthPages}
      />,
    );

    expect(screen.getByRole("heading", { name: "요즘 루다는" })).toBeInTheDocument();
    expect(screen.getByText("2026년 2월")).toBeInTheDocument();
    expect(screen.getAllByText(/총 2장/).length).toBeGreaterThan(0);

    expect(screen.queryByText("요즘 루다 포인트")).not.toBeInTheDocument();
    expect(screen.queryByText("전체 앨범")).not.toBeInTheDocument();
    expect(screen.queryByText("이벤트별")).not.toBeInTheDocument();
    expect(screen.queryByText("랜덤 데이 미리보기")).not.toBeInTheDocument();
  });
});
