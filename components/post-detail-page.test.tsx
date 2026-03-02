/* eslint-disable @next/next/no-img-element */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PostDetailPage } from "./post-detail-page";

const fetchMock = vi.fn();

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { priority, ...rest } = props;
    void priority;
    return <img {...rest} alt={String(props.alt ?? "")} />;
  },
}));

vi.mock("./gallery-lightbox", () => ({
  GalleryLightbox: ({ lightbox }: { lightbox: { items: Array<{ id: string }>; index: number } }) => (
    <div data-testid="post-lightbox">selected:{lightbox.items[lightbox.index]?.id}</div>
  ),
}));

const createPost = (photoCount: number) => {
  const takenAt = "2026-02-20T09:00:00.000Z";

  return {
    id: "post-1",
    caption: "같은 게시글",
    takenAt,
    commentPhotoId: "post-photo-0",
    photos: Array.from({ length: photoCount }, (_, index) => ({
      id: `post-photo-${index}`,
      src: `/post-photo-${index}.jpg`,
      thumbSrc: `/post-photo-${index}.jpg`,
      alt: `post-photo-${index}`,
      caption: "같은 게시글",
      eventNames: [],
      takenAt,
      updatedAt: takenAt,
      visibility: "family" as const,
      isFeatured: false,
      featuredRank: null,
    })),
  };
};

describe("PostDetailPage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders all post photos in grid", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<PostDetailPage post={createPost(12)} />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /번 사진 보기/ })).toHaveLength(12);
    });
  });

  it("loads and submits post comments", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "comment-1",
            photo_id: "post-photo-0",
            nickname: "할머니",
            message: "좋아요",
            created_at: "2026-02-20T09:10:00.000Z",
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    render(<PostDetailPage post={createPost(3)} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/photos/post-photo-0/comments",
        expect.objectContaining({ method: "GET" }),
      );
    });

    fireEvent.change(screen.getByLabelText("댓글 내용"), {
      target: { value: "좋아요" },
    });
    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "할머니" },
    });
    fireEvent.click(screen.getByRole("button", { name: "남기기" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/photos/post-photo-0/comments",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(screen.getByText("좋아요")).toBeInTheDocument();
  });

  it("opens the same lightbox UI when a photo is clicked", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<PostDetailPage post={createPost(2)} />);

    fireEvent.click(screen.getByRole("button", { name: "2번 사진 보기" }));
    expect(await screen.findByTestId("post-lightbox")).toHaveTextContent("selected:post-photo-1");
  });
});
