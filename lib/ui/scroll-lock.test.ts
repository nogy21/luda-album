import { afterEach, describe, expect, it, vi } from "vitest";

import { lockPageScroll, unlockPageScroll } from "./scroll-lock";

describe("scroll lock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute("style");
    document.body.removeAttribute("style");
  });

  it("locks page scroll with a fixed body offset", () => {
    document.documentElement.style.overflow = "clip";
    document.body.style.overflow = "auto";
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 128,
    });

    const snapshot = lockPageScroll(document, window);

    expect(snapshot.scrollY).toBe(128);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-128px");
    expect(document.body.style.width).toBe("100%");
  });

  it("restores original styles and scroll position", () => {
    document.documentElement.style.overflow = "clip";
    document.body.style.overflow = "auto";
    document.body.style.position = "relative";
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 240,
    });
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    const snapshot = lockPageScroll(document, window);
    unlockPageScroll(snapshot, document, window);

    expect(document.documentElement.style.overflow).toBe("clip");
    expect(document.body.style.overflow).toBe("auto");
    expect(document.body.style.position).toBe("relative");
    expect(document.body.style.top).toBe("");
    expect(scrollToSpy).toHaveBeenCalledWith(0, 240);
  });
});
