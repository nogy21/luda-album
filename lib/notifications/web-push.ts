import webpush from "web-push";

import {
  deactivateWebPushSubscription,
  listActiveWebPushSubscriptions,
  markWebPushSubscriptionNotified,
} from "@/lib/notifications/repository";
import type { PushNotificationPayload, StoredWebPushSubscription } from "@/lib/notifications/types";

type RepositoryClient = {
  from: (table: string) => unknown;
};

type PushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

const getPushConfig = (): PushConfig | null => {
  const publicKey =
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY ??
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  return {
    publicKey,
    privateKey,
    subject,
  };
};

export const isWebPushConfigured = () => {
  return getPushConfig() !== null;
};

export const sendWebPushNotification = async (
  subscription: StoredWebPushSubscription,
  payload: PushNotificationPayload,
) => {
  const config = getPushConfig();

  if (!config) {
    throw new Error("Web push config is missing.");
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify(payload),
    { TTL: 60 },
  );
};

const getPushErrorStatusCode = (error: unknown): number | null => {
  if (!error || typeof error !== "object") {
    return null;
  }

  if (!("statusCode" in error)) {
    return null;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : null;
};

const buildUploadPushPayload = (uploadedCount: number): PushNotificationPayload => {
  return {
    title: "루다 앨범",
    body:
      uploadedCount > 1
        ? `새 사진 ${uploadedCount}장이 올라왔어요.`
        : "새 사진이 올라왔어요.",
    icon: "/pwa/icon/192.png",
    badge: "/icons/badge-72.png",
    tag: "luda-album-new-photo",
    url: "/photos",
  };
};

export const notifyUploadedFamilyPhotos = async (
  supabase: RepositoryClient,
  uploadedCount: number,
) => {
  if (uploadedCount <= 0 || !isWebPushConfigured()) {
    return;
  }

  const subscriptions = await listActiveWebPushSubscriptions(supabase);

  if (subscriptions.length === 0) {
    return;
  }

  const payload = buildUploadPushPayload(uploadedCount);

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await sendWebPushNotification(subscription, payload);
        await markWebPushSubscriptionNotified(supabase, subscription.endpoint);
      } catch (error) {
        const statusCode = getPushErrorStatusCode(error);

        if (statusCode === 404 || statusCode === 410) {
          await deactivateWebPushSubscription(supabase, subscription.endpoint);
        }
      }
    }),
  );
};
