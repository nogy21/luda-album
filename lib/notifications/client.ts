import type { WebPushSubscriptionPayload } from "@/lib/notifications/types";

export const urlBase64ToUint8Array = (value: string) => {
  const base64 = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const normalized = base64.replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
};

export const toWebPushSubscriptionPayload = (
  subscription: PushSubscription,
): WebPushSubscriptionPayload | null => {
  const serialized = subscription.toJSON();
  const endpoint = serialized.endpoint;
  const p256dh = serialized.keys?.p256dh;
  const auth = serialized.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    expirationTime: serialized.expirationTime ?? null,
    keys: {
      p256dh,
      auth,
    },
  };
};
