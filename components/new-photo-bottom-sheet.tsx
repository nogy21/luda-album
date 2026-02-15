"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  buildDismissSnoozeUntil,
  buildPhotoDayDeepLink,
  isNewPhotoNoticeEligible,
  toLocalDateKey,
} from "@/lib/ui/new-photo-notice";

type NewPhotoBottomSheetProps = {
  latestPhotoTakenAt?: string | null;
};

const LAST_SEEN_KEY = "luda:new-photo:last-seen";
const SHOWN_DATE_KEY = "luda:new-photo:shown-date";
const SNOOZED_UNTIL_KEY = "luda:new-photo:snoozed-until";

export function NewPhotoBottomSheet({ latestPhotoTakenAt }: NewPhotoBottomSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

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

  if (!open || !latestPhotoTakenAt) {
    return null;
  }

  const handleGo = () => {
    const now = new Date();
    window.localStorage.setItem(LAST_SEEN_KEY, latestPhotoTakenAt);
    window.localStorage.setItem(SHOWN_DATE_KEY, toLocalDateKey(now));
    setOpen(false);
    router.push(deepLink);
  };

  const handleLater = () => {
    const snoozedUntil = buildDismissSnoozeUntil(new Date());
    window.localStorage.setItem(SNOOZED_UNTIL_KEY, snoozedUntil);
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-4 backdrop-blur-[2px] sm:p-6">
      <section
        className="mx-auto w-full max-w-[860px] overflow-hidden rounded-[1.26rem] border border-white/14 bg-[color:var(--color-ink)] text-white shadow-[0_20px_44px_rgba(0,0,0,0.42)]"
        role="dialog"
        aria-modal="true"
        aria-label="새 사진 알림"
      >
        <div className="bg-[linear-gradient(135deg,var(--color-brand),var(--color-brand-strong))] px-5 py-5">
          <h2 className="text-[1.13rem] font-semibold leading-[1.3] tracking-[-0.01em]">
            루다의 새 사진이 올라왔어요
          </h2>
          <p className="mt-1 text-[0.9rem] text-white/88">지금 바로 확인해볼까요?</p>
        </div>
        <div className="space-y-3 px-4 pb-4 pt-3">
          <button
            type="button"
            onClick={handleGo}
            className="ui-btn ui-btn-primary min-h-12 w-full rounded-[1rem] px-4 text-[0.9rem]"
          >
            보러 가기
          </button>
          <button
            type="button"
            onClick={() => {
              handleLater();
            }}
            className="ui-btn w-full rounded-[0.8rem] border border-white/26 bg-white/10 py-2 text-center text-white/86 hover:bg-white/16"
          >
            나중에
          </button>
        </div>
      </section>
    </div>
  );
}
