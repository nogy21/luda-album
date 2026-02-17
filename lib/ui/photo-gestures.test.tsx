import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePhotoGestures } from "./photo-gestures";

const RECT = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  width: 320,
  height: 240,
  right: 320,
  bottom: 240,
  toJSON: () => ({}),
};

function parseScale(transform: string): number {
  const match = transform.match(/scale\(([^)]+)\)/);
  return match ? Number(match[1]) : 1;
}

function parseTranslate(transform: string): { x: number; y: number } {
  const match = transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0(px)?\)/);

  if (!match) {
    return { x: 0, y: 0 };
  }

  return {
    x: Number(match[1]),
    y: Number(match[2]),
  };
}

function GestureHarness({
  enabled = true,
  onNavigatePrev,
  onNavigateNext,
}: {
  enabled?: boolean;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
}) {
  const { scale, isZoomed, transformStyle, bind, resetTransform } = usePhotoGestures({
    enabled,
    onNavigatePrev,
    onNavigateNext,
  });

  return (
    <div>
      <div data-testid="viewer" {...bind}>
        <div data-testid="image" style={transformStyle} />
      </div>
      <p data-testid="scale">{scale}</p>
      <p data-testid="zoomed">{isZoomed ? "yes" : "no"}</p>
      <button type="button" onClick={resetTransform}>
        reset
      </button>
    </div>
  );
}

function prepareViewer() {
  const viewer = screen.getByTestId("viewer") as HTMLDivElement;

  Object.defineProperty(viewer, "getBoundingClientRect", {
    configurable: true,
    value: () => RECT,
  });
  Object.defineProperty(viewer, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(viewer, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  });

  return viewer;
}

describe("usePhotoGestures", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("clamps pinch zoom between min and max", () => {
    render(<GestureHarness />);
    const viewer = prepareViewer();

    fireEvent.pointerDown(viewer, { pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerDown(viewer, { pointerId: 2, pointerType: "touch", clientX: 200, clientY: 100 });
    fireEvent.pointerMove(viewer, { pointerId: 2, pointerType: "touch", clientX: 260, clientY: 100 });

    let transform = (screen.getByTestId("image") as HTMLDivElement).style.transform;
    expect(parseScale(transform)).toBeGreaterThan(1);

    fireEvent.pointerMove(viewer, { pointerId: 2, pointerType: "touch", clientX: 1600, clientY: 100 });
    transform = (screen.getByTestId("image") as HTMLDivElement).style.transform;
    expect(parseScale(transform)).toBeLessThanOrEqual(4);
  });

  it("clamps pan offset while zoomed", () => {
    render(<GestureHarness />);
    const viewer = prepareViewer();

    fireEvent.pointerDown(viewer, { pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerDown(viewer, { pointerId: 2, pointerType: "touch", clientX: 200, clientY: 100 });
    fireEvent.pointerMove(viewer, { pointerId: 2, pointerType: "touch", clientX: 320, clientY: 100 });
    fireEvent.pointerUp(viewer, { pointerId: 2, pointerType: "touch", clientX: 320, clientY: 100 });
    fireEvent.pointerUp(viewer, { pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });

    fireEvent.pointerDown(viewer, { pointerId: 3, pointerType: "touch", clientX: 120, clientY: 120 });
    fireEvent.pointerMove(viewer, { pointerId: 3, pointerType: "touch", clientX: 820, clientY: 760 });
    fireEvent.pointerUp(viewer, { pointerId: 3, pointerType: "touch", clientX: 820, clientY: 760 });

    const transform = (screen.getByTestId("image") as HTMLDivElement).style.transform;
    const currentScale = parseScale(transform);
    const maxOffsetX = (RECT.width * (currentScale - 1)) / 2;
    const maxOffsetY = (RECT.height * (currentScale - 1)) / 2;
    const { x, y } = parseTranslate(transform);

    expect(Math.abs(x)).toBeLessThanOrEqual(maxOffsetX);
    expect(Math.abs(y)).toBeLessThanOrEqual(maxOffsetY);
  });

  it("navigates with swipe when scale is 1", () => {
    const onNavigatePrev = vi.fn();
    const onNavigateNext = vi.fn();

    render(<GestureHarness onNavigatePrev={onNavigatePrev} onNavigateNext={onNavigateNext} />);
    const viewer = prepareViewer();

    fireEvent.pointerDown(viewer, {
      pointerId: 10,
      pointerType: "touch",
      clientX: 240,
      clientY: 120,
      timeStamp: 0,
    });
    fireEvent.pointerMove(viewer, {
      pointerId: 10,
      pointerType: "touch",
      clientX: 120,
      clientY: 120,
      timeStamp: 120,
    });
    fireEvent.pointerUp(viewer, {
      pointerId: 10,
      pointerType: "touch",
      clientX: 120,
      clientY: 120,
      timeStamp: 120,
    });

    expect(onNavigateNext).toHaveBeenCalledTimes(1);
    expect(onNavigatePrev).toHaveBeenCalledTimes(0);
  });

  it("locks swipe navigation when zoomed in", () => {
    const onNavigateNext = vi.fn();

    render(<GestureHarness onNavigateNext={onNavigateNext} />);
    const viewer = prepareViewer();

    fireEvent.pointerDown(viewer, { pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerDown(viewer, { pointerId: 2, pointerType: "touch", clientX: 200, clientY: 100 });
    fireEvent.pointerMove(viewer, { pointerId: 2, pointerType: "touch", clientX: 320, clientY: 100 });
    fireEvent.pointerUp(viewer, { pointerId: 2, pointerType: "touch", clientX: 320, clientY: 100 });
    fireEvent.pointerUp(viewer, { pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });

    fireEvent.pointerDown(viewer, {
      pointerId: 11,
      pointerType: "touch",
      clientX: 240,
      clientY: 120,
      timeStamp: 0,
    });
    fireEvent.pointerMove(viewer, {
      pointerId: 11,
      pointerType: "touch",
      clientX: 90,
      clientY: 120,
      timeStamp: 120,
    });
    fireEvent.pointerUp(viewer, {
      pointerId: 11,
      pointerType: "touch",
      clientX: 90,
      clientY: 120,
      timeStamp: 120,
    });

    expect(onNavigateNext).toHaveBeenCalledTimes(0);
  });

  it("resets transform state", () => {
    render(<GestureHarness />);
    const viewer = prepareViewer();

    fireEvent.pointerDown(viewer, { pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerDown(viewer, { pointerId: 2, pointerType: "touch", clientX: 200, clientY: 100 });
    fireEvent.pointerMove(viewer, { pointerId: 2, pointerType: "touch", clientX: 320, clientY: 100 });
    fireEvent.pointerUp(viewer, { pointerId: 2, pointerType: "touch", clientX: 320, clientY: 100 });
    fireEvent.pointerUp(viewer, { pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerDown(viewer, { pointerId: 3, pointerType: "touch", clientX: 120, clientY: 120 });
    fireEvent.pointerMove(viewer, { pointerId: 3, pointerType: "touch", clientX: 360, clientY: 220 });
    fireEvent.pointerUp(viewer, { pointerId: 3, pointerType: "touch", clientX: 360, clientY: 220 });

    fireEvent.click(screen.getByRole("button", { name: "reset" }));

    const transform = (screen.getByTestId("image") as HTMLDivElement).style.transform;
    expect(parseScale(transform)).toBe(1);
    expect(parseTranslate(transform)).toEqual({ x: 0, y: 0 });
    expect(screen.getByTestId("zoomed")).toHaveTextContent("no");
  });
});
