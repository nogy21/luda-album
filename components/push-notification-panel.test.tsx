import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PushNotificationPanel } from "./push-notification-panel";

const installMediaQueryList = {
  matches: false,
  media: "(display-mode: standalone)",
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
} as MediaQueryList;

const setNavigatorUserAgent = (userAgent: string) => {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
};

describe("PushNotificationPanel", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      value: () => installMediaQueryList,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows iOS install guidance before standalone mode", async () => {
    setNavigatorUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );

    render(<PushNotificationPanel />);

    expect(
      await screen.findByText("iPhone/iPad에서는 먼저 홈 화면에 추가해야 알림을 켤 수 있어요."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("브라우저 공유 버튼(사파리/크롬) → 홈 화면에 추가 순서로 설치해 주세요."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("현재 브라우저는 웹 푸시를 지원하지 않아요."),
    ).not.toBeInTheDocument();
  });

  it("keeps unsupported message for non-iOS browsers without push", async () => {
    setNavigatorUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    );

    render(<PushNotificationPanel />);

    expect(
      await screen.findByText("현재 브라우저는 웹 푸시를 지원하지 않아요."),
    ).toBeInTheDocument();
  });
});
