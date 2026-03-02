/* eslint-disable @next/next/no-img-element */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeTimelineSection } from "./home-timeline-section";

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  elements: Set<Element>;
};

const observerRecords: ObserverRecord[] = [];

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

class MockIntersectionObserver {
  private readonly record: ObserverRecord;

  constructor(callback: IntersectionObserverCallback) {
    this.record = {
      callback,
      elements: new Set(),
    };
    observerRecords.push(this.record);
  }

  observe = (target: Element) => {
    this.record.elements.add(target);
  };

  disconnect = () => {
    this.record.elements.clear();
  };

  unobserve = (target: Element) => {
    this.record.elements.delete(target);
  };

  takeRecords = () => {
    return [];
  };

  readonly root = null;

  readonly rootMargin = "0px";

  readonly thresholds = [0];
}

const triggerIntersection = (target: Element) => {
  const entry = {
    isIntersecting: true,
    target,
  } as IntersectionObserverEntry;

  for (const record of observerRecords) {
    if (!record.elements.has(target)) {
      continue;
    }

    record.callback([entry], {} as IntersectionObserver);
  }
};

const createDescItems = (count: number, start = 0) => {
  return Array.from({ length: count }, (_, index) => {
    const order = start + index;
    const takenAt = new Date(Date.UTC(2026, 1, 20 - order, 9, 0, 0)).toISOString();

    return {
      id: `photo-${order}`,
      src: `/photo-${order}.jpg`,
      thumbSrc: `/thumb-${order}.jpg`,
      alt: `photo-${order}`,
      caption: `photo-${order}`,
      eventNames: [],
      takenAt,
      updatedAt: takenAt,
      visibility: "family" as const,
      isFeatured: false,
      featuredRank: null,
    };
  });
};

beforeAll(() => {
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });
});

beforeEach(() => {
  observerRecords.length = 0;
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HomeTimelineSection", () => {
  it("renders newest posts at the top", async () => {
    render(
      <HomeTimelineSection
        initialItems={createDescItems(10)}
        initialNextCursor="cursor-1"
      />,
    );

    const cards = await screen.findAllByTestId(/home-post-card-/);
    expect(cards).toHaveLength(10);
    expect(cards[0]).toHaveAttribute("data-post-id", "photo-0");
    expect(cards[9]).toHaveAttribute("data-post-id", "photo-9");
  });

  it("loads the next 10 items when the second bottom card intersects", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: createDescItems(10, 10),
        nextCursor: "cursor-2",
      }),
    } as Response);

    render(
      <HomeTimelineSection
        initialItems={createDescItems(10)}
        initialNextCursor="cursor-1"
      />,
    );

    const initialCards = await screen.findAllByTestId(/home-post-card-/);
    triggerIntersection(initialCards[initialCards.length - 2] as Element);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/posts/timeline?cursor=cursor-1&limit=10");

    await waitFor(() => {
      expect(screen.getAllByTestId(/home-post-card-/)).toHaveLength(20);
    });
  });

  it("renders a compact media grid when a post has multiple photos", async () => {
    const sharedTakenAt = "2026-02-19T09:00:00.000Z";
    render(
      <HomeTimelineSection
        initialItems={[
          {
            id: "multi-1",
            src: "/m1.jpg",
            thumbSrc: "/m1.jpg",
            alt: "m1",
            caption: "같은 게시글",
            eventNames: [],
            takenAt: sharedTakenAt,
            updatedAt: sharedTakenAt,
            visibility: "family",
            isFeatured: false,
            featuredRank: null,
          },
          {
            id: "multi-2",
            src: "/m2.jpg",
            thumbSrc: "/m2.jpg",
            alt: "m2",
            caption: "같은 게시글",
            eventNames: [],
            takenAt: sharedTakenAt,
            updatedAt: sharedTakenAt,
            visibility: "family",
            isFeatured: false,
            featuredRank: null,
          },
        ]}
        initialNextCursor={null}
      />,
    );

    const cards = await screen.findAllByTestId(/home-post-card-/);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute("data-photo-count", "2");
    expect(screen.getAllByAltText(/m[12]/)).toHaveLength(2);
  });

  it("shows up to 10 photos and links overflow to post detail page", async () => {
    const sharedTakenAt = "2026-02-19T09:00:00.000Z";

    render(
      <HomeTimelineSection
        initialItems={Array.from({ length: 11 }, (_, index) => ({
          id: `overflow-${index}`,
          src: `/overflow-${index}.jpg`,
          thumbSrc: `/overflow-${index}.jpg`,
          alt: `overflow-${index}`,
          caption: "같은 게시글",
          eventNames: [],
          takenAt: sharedTakenAt,
          updatedAt: sharedTakenAt,
          visibility: "family",
          isFeatured: false,
          featuredRank: null,
        }))}
        initialNextCursor={null}
      />,
    );

    const card = await screen.findByTestId("home-post-card-overflow-0");
    expect(card).toHaveAttribute("data-photo-count", "11");
    expect(card.querySelectorAll("img")).toHaveLength(10);
    expect(card).toHaveTextContent("+1");

    const detailLink = card.querySelector("a");
    expect(detailLink).not.toBeNull();
    expect(detailLink).toHaveAttribute("href", "/posts/overflow-0");
  });

  it("groups photos into one post when takenAt is the same", async () => {
    const sharedTakenAt = "2026-02-19T09:00:00.000Z";
    render(
      <HomeTimelineSection
        initialItems={[
          {
            id: "same-time-a",
            src: "/a.jpg",
            thumbSrc: "/a.jpg",
            alt: "a",
            caption: "a-caption",
            eventNames: [],
            takenAt: sharedTakenAt,
            updatedAt: sharedTakenAt,
            visibility: "family",
            isFeatured: false,
            featuredRank: null,
          },
          {
            id: "same-time-b",
            src: "/b.jpg",
            thumbSrc: "/b.jpg",
            alt: "b",
            caption: "b-caption",
            eventNames: [],
            takenAt: sharedTakenAt,
            updatedAt: sharedTakenAt,
            visibility: "family",
            isFeatured: false,
            featuredRank: null,
          },
        ]}
        initialNextCursor={null}
      />,
    );

    const cards = await screen.findAllByTestId(/home-post-card-/);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute("data-photo-count", "2");
  });

  it("does not request more when nextCursor is null", async () => {
    const fetchMock = vi.mocked(fetch);

    render(
      <HomeTimelineSection
        initialItems={createDescItems(10)}
        initialNextCursor={null}
      />,
    );

    const cards = await screen.findAllByTestId(/home-post-card-/);
    triggerIntersection(cards[cards.length - 2] as Element);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prevents duplicate requests for the same cursor during rapid intersections", async () => {
    const fetchMock = vi.mocked(fetch);
    let resolveFetch: ((value: Response) => void) | undefined;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock.mockReturnValue(pendingFetch);

    render(
      <HomeTimelineSection
        initialItems={createDescItems(10)}
        initialNextCursor="cursor-1"
      />,
    );

    const cards = await screen.findAllByTestId(/home-post-card-/);
    triggerIntersection(cards[cards.length - 2] as Element);
    triggerIntersection(cards[cards.length - 2] as Element);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch?.({
      ok: true,
      json: async () => ({
        items: createDescItems(10, 10),
        nextCursor: null,
      }),
    } as Response);

    await waitFor(() => {
      expect(screen.getAllByTestId(/home-post-card-/)).toHaveLength(20);
    });
  });

  it("shows an error and retries without dropping existing posts", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockRejectedValueOnce(new Error("네트워크 오류"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: createDescItems(10, 10),
          nextCursor: null,
        }),
      } as Response);

    render(
      <HomeTimelineSection
        initialItems={createDescItems(10)}
        initialNextCursor="cursor-1"
      />,
    );

    const cards = await screen.findAllByTestId(/home-post-card-/);
    triggerIntersection(cards[cards.length - 2] as Element);

    await screen.findByText("네트워크 오류");
    expect(screen.getAllByTestId(/home-post-card-/)).toHaveLength(10);

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => {
      expect(screen.getAllByTestId(/home-post-card-/)).toHaveLength(20);
    });
  });
});
