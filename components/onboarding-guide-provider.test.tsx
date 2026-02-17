import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingGuideProvider, useOnboardingGuide } from "./onboarding-guide-provider";

let pathnameMock = "/";
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock,
  useRouter: () => ({
    push: pushMock,
  }),
}));

function Trigger() {
  const { openGuide } = useOnboardingGuide();

  return (
    <button type="button" onClick={openGuide}>
      가이드 다시 열기
    </button>
  );
}

function renderWithProvider() {
  return render(
    <OnboardingGuideProvider>
      <Trigger />
    </OnboardingGuideProvider>,
  );
}

describe("OnboardingGuideProvider", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    pathnameMock = "/";
    pushMock.mockReset();

    const localStore = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => localStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
          localStore.set(key, value);
        },
        removeItem: (key: string) => {
          localStore.delete(key);
        },
        clear: () => {
          localStore.clear();
        },
      },
    });

    const sessionStore = new Map<string, string>();
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => sessionStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
          sessionStore.set(key, value);
        },
        removeItem: (key: string) => {
          sessionStore.delete(key);
        },
        clear: () => {
          sessionStore.clear();
        },
      },
    });
  });

  it("auto-opens tutorial for first visit", async () => {
    renderWithProvider();

    expect(await screen.findByRole("dialog", { name: "사용 가이드" })).toBeInTheDocument();
    expect(screen.getByText("1 / 5")).toBeInTheDocument();
    expect(screen.getByText("루다 앨범에 오신 걸 환영해요")).toBeInTheDocument();
  });

  it("moves steps and pushes route when step route changes", async () => {
    renderWithProvider();
    await screen.findByRole("dialog", { name: "사용 가이드" });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("2 / 5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(pushMock).toHaveBeenCalledWith("/photos");
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
  });

  it("skip hides dialog and suppresses auto-open in current session", async () => {
    const { unmount } = renderWithProvider();
    await screen.findByRole("dialog", { name: "사용 가이드" });

    fireEvent.click(screen.getByRole("button", { name: "나중에 보기" }));
    expect(screen.queryByRole("dialog", { name: "사용 가이드" })).not.toBeInTheDocument();

    unmount();
    renderWithProvider();

    expect(screen.queryByRole("dialog", { name: "사용 가이드" })).not.toBeInTheDocument();
  });

  it("does not auto-open after completion", async () => {
    const { unmount } = renderWithProvider();
    await screen.findByRole("dialog", { name: "사용 가이드" });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "완료" }));

    expect(screen.queryByRole("dialog", { name: "사용 가이드" })).not.toBeInTheDocument();

    unmount();
    renderWithProvider();

    expect(screen.queryByRole("dialog", { name: "사용 가이드" })).not.toBeInTheDocument();
  });

  it("manual open works even after completion", () => {
    window.localStorage.setItem(
      "luda:onboarding-guide:progress:v1",
      JSON.stringify({ completed: true, completedAt: "2026-02-17T10:00:00.000Z" }),
    );

    renderWithProvider();

    expect(screen.queryByRole("dialog", { name: "사용 가이드" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "가이드 다시 열기" }));

    expect(screen.getByRole("dialog", { name: "사용 가이드" })).toBeInTheDocument();
    expect(screen.getByText("1 / 5")).toBeInTheDocument();
  });
});
