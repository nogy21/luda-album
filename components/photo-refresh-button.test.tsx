import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhotoRefreshButton } from "./photo-refresh-button";

afterEach(() => {
  cleanup();
});

describe("PhotoRefreshButton", () => {
  it("reloads the page when clicked", () => {
    const onRefresh = vi.fn();

    render(<PhotoRefreshButton onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: "새 사진 불러오기" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("shows helper copy for elders", () => {
    render(<PhotoRefreshButton />);

    expect(
      screen.getByText("아래로 당겨 새로고침이 안 되면 이 버튼을 눌러주세요."),
    ).toBeInTheDocument();
  });
});
