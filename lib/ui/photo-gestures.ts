import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const DEFAULT_MIN_SCALE = 1;
const DEFAULT_MAX_SCALE = 4;
const DEFAULT_DOUBLE_TAP_SCALE = 2.5;
const DEFAULT_SWIPE_THRESHOLD = 56;
const DEFAULT_SWIPE_VELOCITY = 0.45;

type Point = {
  x: number;
  y: number;
};

type PointerRecord = Point;

type GestureOptions = {
  enabled: boolean;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  minScale?: number;
  maxScale?: number;
  doubleTapScale?: number;
  swipeThreshold?: number;
  swipeVelocityThreshold?: number;
};

type GestureBind = {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: (event: MouseEvent<HTMLDivElement>) => void;
};

type GestureResult = {
  scale: number;
  isZoomed: boolean;
  transformStyle: CSSProperties;
  bind: GestureBind;
  resetTransform: () => void;
};

type DragState = {
  pointerId: number;
  startPoint: Point;
  startOffset: Point;
  startTime: number;
  moved: boolean;
};

type PinchState = {
  startDistance: number;
  startScale: number;
  startOffset: Point;
  startCenter: Point;
};

const distance = (left: Point, right: Point) => {
  return Math.hypot(left.x - right.x, left.y - right.y);
};

const center = (left: Point, right: Point): Point => ({
  x: (left.x + right.x) / 2,
  y: (left.y + right.y) / 2,
});

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

export function usePhotoGestures({
  enabled,
  onNavigatePrev,
  onNavigateNext,
  minScale = DEFAULT_MIN_SCALE,
  maxScale = DEFAULT_MAX_SCALE,
  doubleTapScale = DEFAULT_DOUBLE_TAP_SCALE,
  swipeThreshold = DEFAULT_SWIPE_THRESHOLD,
  swipeVelocityThreshold = DEFAULT_SWIPE_VELOCITY,
}: GestureOptions): GestureResult {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const pointersRef = useRef(new Map<number, PointerRecord>());
  const dragStateRef = useRef<DragState | null>(null);
  const pinchStateRef = useRef<PinchState | null>(null);
  const tapStateRef = useRef<{ at: number; point: Point } | null>(null);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const clearGestureState = useCallback(() => {
    pointersRef.current.clear();
    dragStateRef.current = null;
    pinchStateRef.current = null;
    tapStateRef.current = null;
  }, []);

  const resetTransform = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
  }, []);

  const clampScale = useCallback(
    (nextScale: number) => clamp(nextScale, minScale, maxScale),
    [maxScale, minScale],
  );

  const clampOffset = useCallback((nextOffset: Point, nextScale: number, rect: DOMRect): Point => {
    if (nextScale <= 1) {
      return { x: 0, y: 0 };
    }

    const maxOffsetX = (rect.width * (nextScale - 1)) / 2;
    const maxOffsetY = (rect.height * (nextScale - 1)) / 2;

    return {
      x: clamp(nextOffset.x, -maxOffsetX, maxOffsetX),
      y: clamp(nextOffset.y, -maxOffsetY, maxOffsetY),
    };
  }, []);

  const updateTransform = useCallback(
    (nextScale: number, nextOffset: Point, rect: DOMRect) => {
      const clampedScale = clampScale(nextScale);
      const clampedOffset = clampOffset(nextOffset, clampedScale, rect);
      setScale(clampedScale);
      setOffset(clampedOffset);
      scaleRef.current = clampedScale;
      offsetRef.current = clampedOffset;
    },
    [clampOffset, clampScale],
  );

  const applyDoubleTapZoom = useCallback(
    (event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();

      if (scaleRef.current > 1) {
        resetTransform();
        return;
      }

      const targetScale = clampScale(doubleTapScale);
      const relativeX = event.clientX - rect.left - rect.width / 2;
      const relativeY = event.clientY - rect.top - rect.height / 2;
      const nextOffset = {
        x: -relativeX * (targetScale - 1),
        y: -relativeY * (targetScale - 1),
      };

      updateTransform(targetScale, nextOffset, rect);
    },
    [clampScale, doubleTapScale, resetTransform, updateTransform],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!enabled) {
        return;
      }

      event.currentTarget.setPointerCapture?.(event.pointerId);

      const point: Point = { x: event.clientX, y: event.clientY };
      pointersRef.current.set(event.pointerId, point);

      const pointerValues = [...pointersRef.current.values()];

      if (pointerValues.length >= 2) {
        const [left, right] = pointerValues;
        pinchStateRef.current = {
          startDistance: Math.max(1, distance(left, right)),
          startScale: scaleRef.current,
          startOffset: offsetRef.current,
          startCenter: center(left, right),
        };
        dragStateRef.current = null;
        return;
      }

      dragStateRef.current = {
        pointerId: event.pointerId,
        startPoint: point,
        startOffset: offsetRef.current,
        startTime: event.timeStamp || performance.now(),
        moved: false,
      };
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!enabled) {
        return;
      }

      if (!pointersRef.current.has(event.pointerId)) {
        return;
      }

      const point: Point = { x: event.clientX, y: event.clientY };
      pointersRef.current.set(event.pointerId, point);

      const rect = event.currentTarget.getBoundingClientRect();
      const pointerValues = [...pointersRef.current.values()];
      const pinchState = pinchStateRef.current;

      if (pinchState && pointerValues.length >= 2) {
        const [left, right] = pointerValues;
        const currentDistance = Math.max(1, distance(left, right));
        const currentCenter = center(left, right);
        const nextScale = pinchState.startScale * (currentDistance / pinchState.startDistance);
        const centerDelta = {
          x: currentCenter.x - pinchState.startCenter.x,
          y: currentCenter.y - pinchState.startCenter.y,
        };
        const nextOffset = {
          x: pinchState.startOffset.x + centerDelta.x,
          y: pinchState.startOffset.y + centerDelta.y,
        };

        updateTransform(nextScale, nextOffset, rect);
        return;
      }

      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = point.x - dragState.startPoint.x;
      const deltaY = point.y - dragState.startPoint.y;
      dragState.moved = dragState.moved || Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;

      if (scaleRef.current > 1) {
        const nextOffset = {
          x: dragState.startOffset.x + deltaX,
          y: dragState.startOffset.y + deltaY,
        };
        updateTransform(scaleRef.current, nextOffset, rect);
      }
    },
    [enabled, updateTransform],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!enabled) {
        return;
      }

      const now = event.timeStamp || performance.now();
      const point: Point = { x: event.clientX, y: event.clientY };
      const rect = event.currentTarget.getBoundingClientRect();
      const dragState = dragStateRef.current;

      if (
        dragState &&
        dragState.pointerId === event.pointerId &&
        !pinchStateRef.current &&
        scaleRef.current <= 1
      ) {
        const deltaX = point.x - dragState.startPoint.x;
        const deltaY = point.y - dragState.startPoint.y;
        const elapsed = Math.max(1, now - dragState.startTime);
        const velocityX = deltaX / elapsed;
        const isVerticalIntent = Math.abs(deltaY) > 84;
        const isFarSwipe = Math.abs(deltaX) >= swipeThreshold;
        const isFastSwipe = Math.abs(deltaX) >= 24 && Math.abs(velocityX) >= swipeVelocityThreshold;

        if (!isVerticalIntent && (isFarSwipe || isFastSwipe)) {
          if (deltaX < 0) {
            onNavigateNext?.();
          } else {
            onNavigatePrev?.();
          }

          tapStateRef.current = null;
        } else if (!dragState.moved) {
          const previousTap = tapStateRef.current;

          if (
            previousTap &&
            now - previousTap.at <= 280 &&
            distance(previousTap.point, point) <= 24
          ) {
            applyDoubleTapZoom(event);
            tapStateRef.current = null;
          } else {
            tapStateRef.current = { at: now, point };
          }
        } else {
          tapStateRef.current = null;
        }
      }

      pointersRef.current.delete(event.pointerId);
      event.currentTarget.releasePointerCapture?.(event.pointerId);

      if (pointersRef.current.size < 2) {
        pinchStateRef.current = null;
      }
      if (dragStateRef.current?.pointerId === event.pointerId) {
        dragStateRef.current = null;
      }

      if (scaleRef.current <= 1) {
        updateTransform(1, { x: 0, y: 0 }, rect);
      }
    },
    [
      applyDoubleTapZoom,
      enabled,
      onNavigateNext,
      onNavigatePrev,
      swipeThreshold,
      swipeVelocityThreshold,
      updateTransform,
    ],
  );

  const onPointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      pointersRef.current.delete(event.pointerId);
      event.currentTarget.releasePointerCapture?.(event.pointerId);

      if (pointersRef.current.size < 2) {
        pinchStateRef.current = null;
      }
      if (dragStateRef.current?.pointerId === event.pointerId) {
        dragStateRef.current = null;
      }
    },
    [],
  );

  const onDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!enabled) {
        return;
      }

      applyDoubleTapZoom(event);
    },
    [applyDoubleTapZoom, enabled],
  );

  useEffect(() => {
    if (!enabled) {
      clearGestureState();
    }
  }, [clearGestureState, enabled]);

  useEffect(() => {
    return () => {
      clearGestureState();
    };
  }, [clearGestureState]);

  const bind: GestureBind = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onDoubleClick,
    }),
    [onDoubleClick, onPointerCancel, onPointerDown, onPointerMove, onPointerUp],
  );

  const transformStyle = useMemo<CSSProperties>(() => {
    return {
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
      transformOrigin: "center center",
      touchAction: enabled ? "none" : "auto",
      transition: "transform 160ms ease-out",
      willChange: enabled ? "transform" : undefined,
    };
  }, [enabled, offset.x, offset.y, scale]);

  return {
    scale,
    isZoomed: scale > 1,
    transformStyle,
    bind,
    resetTransform,
  };
}
