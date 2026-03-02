import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingGuestbookCta } from "./landing-guestbook-cta";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: Record<string, unknown>) => (
    <a href={String(href ?? "#")} {...rest}>
      {children as ReactNode}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("LandingGuestbookCta", () => {
  it("stays fixed above bottom navigation", () => {
    const { container } = render(<LandingGuestbookCta />);
    const root = container.firstElementChild;

    expect(root).not.toBeNull();
    expect(root?.className).toContain("fixed");
    expect(root?.className).toContain("z-[var(--z-bottom-cta)]");
    expect(root?.className).toContain("bottom-[var(--floating-guestbook-cta-bottom)]");
  });

  it("builds guestbook prefill link from typed message", () => {
    render(<LandingGuestbookCta />);

    fireEvent.change(screen.getByPlaceholderText("보고 싶은 말 한 줄을 남겨주세요"), {
      target: { value: "루다 사랑해" },
    });

    const link = screen.getByRole("link", { name: "덕담 쓰기" });
    expect(link.getAttribute("href")).toBe("/guestbook?prefill=%EB%A3%A8%EB%8B%A4%20%EC%82%AC%EB%9E%91%ED%95%B4");
  });
});
