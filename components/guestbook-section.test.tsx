import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuestbookSection } from "./guestbook-section";

const fetchMock = vi.fn();

describe("GuestbookSection", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows success toast after guestbook submit", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "created-1",
            nickname: "가족",
            message: "루다야 사랑해",
            created_at: "2026-02-16T09:00:00.000Z",
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    render(<GuestbookSection />);

    await screen.findByRole("button", { name: "남기기" });

    fireEvent.change(screen.getByLabelText("덕담"), {
      target: { value: "루다야 사랑해" },
    });
    fireEvent.click(screen.getByRole("button", { name: "남기기" }));

    await waitFor(() => {
      expect(
        screen.getByText("덕담이 등록되었어요.", { selector: "p[role='status']" }),
      ).toBeInTheDocument();
    });
  });

  it("shows error toast when submit fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "덕담 저장에 실패했어요.",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    render(<GuestbookSection />);

    await screen.findByRole("button", { name: "남기기" });

    fireEvent.change(screen.getByLabelText("덕담"), {
      target: { value: "루다야 사랑해" },
    });
    fireEvent.click(screen.getByRole("button", { name: "남기기" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "덕담 등록에 실패했어요. 잠시 후 다시 시도해 주세요.",
      );
    });
  });
});
