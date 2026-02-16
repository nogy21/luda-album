"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import {
  buildDismissSnoozeUntil,
  buildPhotoDayDeepLink,
  isNewPhotoNoticeEligible,
  toLocalDateKey,
} from "@/lib/ui/new-photo-notice";
import { lockPageScroll, unlockPageScroll } from "@/lib/ui/scroll-lock";

type NewPhotoBottomSheetProps = {
  latestPhotoTakenAt?: string | null;
};

const LAST_SEEN_KEY = "luda:new-photo:last-seen";
const SHOWN_DATE_KEY = "luda:new-photo:shown-date";
const SNOOZED_UNTIL_KEY = "luda:new-photo:snoozed-until";

export function NewPhotoBottomSheet({ latestPhotoTakenAt }: NewPhotoBottomSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const afterCloseActionRef = useRef<(() => void) | null>(null);

  const deepLink = useMemo(() => {
    if (!latestPhotoTakenAt) {
      return "/photos";
    }

    return buildPhotoDayDeepLink(latestPhotoTakenAt);
  }, [latestPhotoTakenAt]);

  useEffect(() => {
    if (typeof window === "undefined" || !latestPhotoTakenAt) {
      return;
    }

    const now = new Date();
    const shownDateKey = window.localStorage.getItem(SHOWN_DATE_KEY);
    const snoozedUntilIso = window.localStorage.getItem(SNOOZED_UNTIL_KEY);
    const lastSeenTakenAt = window.localStorage.getItem(LAST_SEEN_KEY);

    const eligible = isNewPhotoNoticeEligible({
      now,
      latestPhotoTakenAt,
      shownDateKey,
      snoozedUntilIso,
      lastSeenTakenAt,
    });

    if (!eligible) {
      return;
    }

    window.localStorage.setItem(SHOWN_DATE_KEY, toLocalDateKey(now));
    const timer = window.setTimeout(() => {
      setOpen(true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [latestPhotoTakenAt]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const snapshot = lockPageScroll();

    return () => {
      unlockPageScroll(snapshot);
    };
  }, [open]);

  const closeSheet = useCallback(
    (afterClose?: () => void) => {
      afterCloseActionRef.current = afterClose ?? null;
      setOpen(false);
    },
    [],
  );

  if (!latestPhotoTakenAt) {
    return null;
  }

  const handleGo = () => {
    const now = new Date();
    window.localStorage.setItem(LAST_SEEN_KEY, latestPhotoTakenAt);
    window.localStorage.setItem(SHOWN_DATE_KEY, toLocalDateKey(now));
    closeSheet(() => {
      router.push(deepLink);
    });
  };

  const handleLater = () => {
    const snoozedUntil = buildDismissSnoozeUntil(new Date());
    window.localStorage.setItem(SNOOZED_UNTIL_KEY, snoozedUntil);
    closeSheet();
  };

  return (
    <AnimatePresence
      onExitComplete={() => {
        const action = afterCloseActionRef.current;
        afterCloseActionRef.current = null;
        action?.();
      }}
    >
      {open ? (
        <motion.div
          className="fixed inset-0 z-[var(--z-overlay)] flex items-end bg-[color:color-mix(in_srgb,var(--color-ink)_28%,transparent)] p-4 backdrop-blur-[3px] sm:p-6"
          style={{ paddingBottom: "max(1rem, calc(var(--safe-area-bottom) + 0.7rem))" }}
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleLater();
            }
          }}
        >
          <div className="layout-container">
            <motion.section
              className="w-full overflow-hidden rounded-[1.2rem] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] shadow-[var(--shadow-float)]"
              role="dialog"
              aria-modal="true"
              aria-label="새 사진 알림"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.99 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="px-5 pt-3">
                <div
                  className="mx-auto h-1 w-11 rounded-full bg-[color:color-mix(in_srgb,var(--color-line)_82%,#fff_18%)]"
                  aria-hidden="true"
                />
              </div>

              <header className="px-5 pb-2 pt-3">
                <div className="mb-2 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-[color:var(--color-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand)]" aria-hidden="true" />
                  <span>새 사진 알림</span>
                </div>
                <h2 className="text-[1.11rem] font-semibold leading-[1.32] tracking-[-0.012em]">
                  루다의 새 사진이 올라왔어요
                </h2>
              </header>

              <div className="space-y-3 px-5 pb-5 pt-1">
                <p className="text-[0.88rem] leading-[1.55] text-[color:var(--color-muted)]">
                  바로 확인하거나, 잠시 뒤 다시 알려드릴게요.
                </p>
                <button
                  type="button"
                  onClick={handleGo}
                  className="ui-btn ui-btn-primary min-h-12 w-full rounded-[0.98rem] px-4 text-[0.9rem]"
                >
                  사진 보러 가기
                </button>
                <button
                  type="button"
                  onClick={handleLater}
                  className="ui-btn ui-btn-secondary min-h-11 w-full rounded-[0.98rem] px-4 text-[0.86rem]"
                >
                  나중에
                </button>

                <p className="flex items-center gap-1.5 text-[0.72rem] leading-[1.45] text-[color:var(--color-muted)]">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent-pink)]"
                    aria-hidden="true"
                  />
                  나중에를 누르면 24시간 뒤에 다시 알려드려요.
                </p>
              </div>
            </motion.section>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
