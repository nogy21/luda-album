"use client";

import { useEffect, useMemo, useState } from "react";

import {
  toWebPushSubscriptionPayload,
  urlBase64ToUint8Array,
} from "@/lib/notifications/client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const vapidPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? "";

const supportsPushNotifications = () => {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
};

const ensureServiceWorkerRegistration = async () => {
  const existing = await navigator.serviceWorker.getRegistration("/");

  if (existing) {
    return existing;
  }

  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
};

const isIosPlatform = (navigatorObject: Navigator) => {
  const userAgent = navigatorObject.userAgent ?? "";
  const platform = navigatorObject.platform ?? "";
  const maxTouchPoints =
    typeof navigatorObject.maxTouchPoints === "number"
      ? navigatorObject.maxTouchPoints
      : 0;

  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
};

export function PushNotificationPanel() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsIos(isIosPlatform(window.navigator));
    const standaloneByMedia = window.matchMedia("(display-mode: standalone)").matches;
    const standaloneByNavigator = (window.navigator as NavigatorWithStandalone).standalone === true;
    setIsStandalone(standaloneByMedia || standaloneByNavigator);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (!supportsPushNotifications()) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);

    void ensureServiceWorkerRegistration()
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setIsSubscribed(Boolean(subscription));
      })
      .catch(() => {
        setIsSubscribed(false);
      });
  }, []);

  const canEnablePush = useMemo(() => {
    return supportsPushNotifications() && vapidPublicKey.length > 0;
  }, []);

  const requiresIosInstall = isIos && !isStandalone;
  const hasInstallAction = !isStandalone && installPrompt !== null;
  const shouldShow =
    requiresIosInstall ||
    hasInstallAction ||
    permission === "unsupported" ||
    permission === "denied" ||
    !isSubscribed;

  if (!shouldShow) {
    return null;
  }

  const handleEnablePush = async () => {
    if (!canEnablePush) {
      setStatusMessage("이 브라우저에서는 푸시 알림을 사용할 수 없어요.");
      return;
    }

    setIsBusy(true);
    setStatusMessage(null);

    try {
      const nextPermission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        setStatusMessage("알림 권한이 필요해요. 브라우저 설정에서 허용해 주세요.");
        return;
      }

      const registration = await ensureServiceWorkerRegistration();
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const payload = toWebPushSubscriptionPayload(subscription);

      if (!payload) {
        setStatusMessage("알림 구독 정보 생성에 실패했어요.");
        return;
      }

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "알림 구독 등록에 실패했어요.");
      }

      setIsSubscribed(true);
      setStatusMessage("새 사진 알림이 켜졌어요.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisablePush = async () => {
    if (!supportsPushNotifications()) {
      setPermission("unsupported");
      return;
    }

    setIsBusy(true);
    setStatusMessage(null);

    try {
      const registration = await ensureServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const payload = toWebPushSubscriptionPayload(subscription);

        if (payload) {
          await fetch("/api/notifications/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: payload.endpoint }),
          });
        }

        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setStatusMessage("알림을 해제했어요.");
    } catch {
      setStatusMessage("알림 해제에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleInstall = async () => {
    if (!installPrompt) {
      return;
    }

    setIsBusy(true);
    setStatusMessage(null);

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setStatusMessage("홈 화면에 앱이 추가됐어요.");
      }
    } finally {
      setInstallPrompt(null);
      setIsBusy(false);
    }
  };

  return (
    <section className="ui-surface mb-[var(--space-section-sm)] rounded-[var(--radius-lg)] p-3.5 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ui-eyebrow">PWA 알림</p>
          <h2 className="mt-1 text-[0.98rem] font-semibold text-[color:var(--color-ink)]">
            새 사진 업로드를 푸시로 받아보기
          </h2>
          <p className="mt-1 text-[0.8rem] text-[color:var(--color-muted)]">
            홈 화면에 설치하고 알림을 허용하면 사진 업로드 시 바로 알려드려요.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasInstallAction ? (
          <button
            type="button"
            onClick={handleInstall}
            disabled={isBusy}
            className="ui-btn ui-btn-secondary px-3"
          >
            앱 설치
          </button>
        ) : null}

        {requiresIosInstall ? (
          <p className="text-[0.8rem] text-[color:var(--color-muted)]">
            iPhone/iPad에서는 먼저 홈 화면에 추가해야 알림을 켤 수 있어요.
          </p>
        ) : permission === "unsupported" ? (
          <p className="text-[0.8rem] text-[color:var(--color-muted)]">
            현재 브라우저는 웹 푸시를 지원하지 않아요.
          </p>
        ) : isSubscribed ? (
          <button
            type="button"
            onClick={handleDisablePush}
            disabled={isBusy}
            className="ui-btn ui-btn-secondary px-3"
          >
            알림 해제
          </button>
        ) : (
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={isBusy}
            className="ui-btn ui-btn-primary px-3.5"
          >
            알림 켜기
          </button>
        )}
      </div>

      {requiresIosInstall ? (
        <p className="mt-2 text-[0.77rem] text-[color:var(--color-muted)]">
          브라우저 공유 버튼(사파리/크롬) → 홈 화면에 추가 순서로 설치해 주세요.
        </p>
      ) : null}

      {permission === "denied" && !requiresIosInstall ? (
        <p className="mt-2 text-[0.77rem] text-[color:var(--color-danger)]">
          브라우저 설정에서 알림 권한을 허용해야 푸시 알림을 받을 수 있어요.
        </p>
      ) : null}

      {statusMessage ? (
        <p className="mt-2 text-[0.77rem] text-[color:var(--color-muted)]">{statusMessage}</p>
      ) : null}

      {!canEnablePush && permission !== "unsupported" && !requiresIosInstall ? (
        <p className="mt-2 text-[0.77rem] text-[color:var(--color-muted)]">
          알림 설정값이 아직 배포 환경에 연결되지 않았어요.
        </p>
      ) : null}
    </section>
  );
}
