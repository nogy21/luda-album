import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addFullscreenChangeListener,
  canUseFullscreen,
  exitFullscreen,
  getFullscreenElement,
  requestFullscreen,
} from "./fullscreen";

const DEFAULT_AUTO_HIDE_MS = 2200;

type UsePhotoViewerModeOptions = {
  frameRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  autoHideMs?: number;
};

type UsePhotoViewerModeResult = {
  isImmersive: boolean;
  isNativeFullscreen: boolean;
  isOverlayVisible: boolean;
  enterImmersive: () => Promise<void>;
  exitImmersive: () => Promise<void>;
  toggleImmersive: () => Promise<void>;
  showOverlayTemporarily: () => void;
};

export function usePhotoViewerMode({
  frameRef,
  isOpen,
  autoHideMs = DEFAULT_AUTO_HIDE_MS,
}: UsePhotoViewerModeOptions): UsePhotoViewerModeResult {
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isFallbackImmersive, setIsFallbackImmersive] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);

  const hideOverlayTimerRef = useRef<number | null>(null);

  const clearHideOverlayTimer = useCallback(() => {
    if (hideOverlayTimerRef.current !== null) {
      window.clearTimeout(hideOverlayTimerRef.current);
      hideOverlayTimerRef.current = null;
    }
  }, []);

  const isImmersive = useMemo(
    () => isOpen && (isNativeFullscreen || isFallbackImmersive),
    [isFallbackImmersive, isNativeFullscreen, isOpen],
  );

  const armHideOverlayTimer = useCallback(() => {
    clearHideOverlayTimer();

    hideOverlayTimerRef.current = window.setTimeout(() => {
      setIsOverlayVisible(false);
    }, autoHideMs);
  }, [autoHideMs, clearHideOverlayTimer]);

  const syncNativeFullscreenState = useCallback(() => {
    const target = frameRef.current;
    const fullscreenElement = getFullscreenElement();
    const isCurrentTargetFullscreen = Boolean(target && fullscreenElement === target);

    setIsNativeFullscreen(isCurrentTargetFullscreen);

    if (isCurrentTargetFullscreen) {
      setIsFallbackImmersive(false);
      setIsOverlayVisible(true);
      armHideOverlayTimer();
      return;
    }

    clearHideOverlayTimer();
    setIsOverlayVisible(true);
  }, [armHideOverlayTimer, clearHideOverlayTimer, frameRef]);

  const showOverlayTemporarily = useCallback(() => {
    setIsOverlayVisible(true);

    if (isImmersive) {
      armHideOverlayTimer();
    }
  }, [armHideOverlayTimer, isImmersive]);

  const enterImmersive = useCallback(async () => {
    if (!isOpen) {
      return;
    }

    const target = frameRef.current;

    setIsOverlayVisible(true);

    if (canUseFullscreen(target)) {
      try {
        await requestFullscreen(target);
        setIsNativeFullscreen(true);
        setIsFallbackImmersive(false);
        armHideOverlayTimer();
        return;
      } catch {
        // Fall back to an in-app immersive mode if native fullscreen fails.
      }
    }

    setIsFallbackImmersive(true);
    armHideOverlayTimer();
  }, [armHideOverlayTimer, frameRef, isOpen]);

  const exitImmersive = useCallback(async () => {
    clearHideOverlayTimer();
    setIsOverlayVisible(true);
    setIsFallbackImmersive(false);
    setIsNativeFullscreen(false);

    if (!isNativeFullscreen) {
      return;
    }

    try {
      await exitFullscreen();
    } catch {
      // Ignore errors and let fullscreenchange listener resync state.
    }
  }, [clearHideOverlayTimer, isNativeFullscreen]);

  const toggleImmersive = useCallback(async () => {
    if (isImmersive) {
      await exitImmersive();
      return;
    }

    await enterImmersive();
  }, [enterImmersive, exitImmersive, isImmersive]);

  useEffect(() => {
    if (!isOpen) {
      clearHideOverlayTimer();
      return;
    }

    return addFullscreenChangeListener(syncNativeFullscreenState);
  }, [clearHideOverlayTimer, isOpen, syncNativeFullscreenState]);

  useEffect(() => {
    return () => {
      clearHideOverlayTimer();
    };
  }, [clearHideOverlayTimer]);

  return {
    isImmersive,
    isNativeFullscreen,
    isOverlayVisible,
    enterImmersive,
    exitImmersive,
    toggleImmersive,
    showOverlayTemporarily,
  };
}
