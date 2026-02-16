import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addFullscreenChangeListener,
  canUseFullscreen,
  exitFullscreen,
  getFullscreenElement,
  requestFullscreen,
} from "./fullscreen";

describe("fullscreen utils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects support when request/exit methods exist", () => {
    const target = document.createElement("div") as HTMLElement & {
      requestFullscreen?: () => Promise<void>;
    };
    const requestMock = vi.fn().mockResolvedValue(undefined);
    const exitMock = vi.fn().mockResolvedValue(undefined);

    target.requestFullscreen = requestMock;
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitMock,
    });

    expect(canUseFullscreen(target, document)).toBe(true);
  });

  it("requests and exits fullscreen with standard API", async () => {
    const target = document.createElement("div") as HTMLElement & {
      requestFullscreen?: () => Promise<void>;
    };
    const requestMock = vi.fn().mockResolvedValue(undefined);
    const exitMock = vi.fn().mockResolvedValue(undefined);

    target.requestFullscreen = requestMock;
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitMock,
    });

    await requestFullscreen(target);
    await exitFullscreen(document);

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to prefixed APIs", async () => {
    const target = document.createElement("div") as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const requestMock = vi.fn().mockResolvedValue(undefined);
    const exitMock = vi.fn().mockResolvedValue(undefined);

    target.webkitRequestFullscreen = requestMock;
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "webkitExitFullscreen", {
      configurable: true,
      value: exitMock,
    });

    await requestFullscreen(target);
    await exitFullscreen(document);

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledTimes(1);
  });

  it("returns active fullscreen element", () => {
    const node = document.createElement("div");

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: node,
    });

    expect(getFullscreenElement(document)).toBe(node);
  });

  it("wires fullscreen change listeners and cleans up", () => {
    const handler = vi.fn();
    const unsubscribe = addFullscreenChangeListener(handler, document);

    document.dispatchEvent(new Event("fullscreenchange"));
    document.dispatchEvent(new Event("webkitfullscreenchange"));

    expect(handler).toHaveBeenCalledTimes(2);

    unsubscribe();
    document.dispatchEvent(new Event("fullscreenchange"));

    expect(handler).toHaveBeenCalledTimes(2);
  });
});
