import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FixedBottomNav } from "./fixed-bottom-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("FixedBottomNav", () => {
  it("renders outside transformed wrappers to keep viewport-fixed behavior", async () => {
    render(
      <div data-testid="wrapper" style={{ transform: "translateY(0)" }}>
        <FixedBottomNav />
      </div>,
    );

    const wrapper = screen.getByTestId("wrapper");

    expect(within(wrapper).queryByRole("navigation", { name: "하단 메뉴" })).not.toBeInTheDocument();
    expect(await screen.findByRole("navigation", { name: "하단 메뉴" })).toBeInTheDocument();
  });
});
