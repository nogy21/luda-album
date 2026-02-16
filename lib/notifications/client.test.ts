import { describe, expect, it } from "vitest";

import {
  toWebPushSubscriptionPayload,
  urlBase64ToUint8Array,
} from "./client";

describe("notifications client helpers", () => {
  it("converts base64 URL string to Uint8Array", () => {
    const output = urlBase64ToUint8Array("AQAB");

    expect(output).toBeInstanceOf(Uint8Array);
    expect([...output]).toEqual([1, 0, 1]);
  });

  it("serializes PushSubscription to payload", () => {
    const subscription = {
      toJSON: () => ({
        endpoint: "https://example.com/push",
        expirationTime: null,
        keys: {
          p256dh: "key-p256dh",
          auth: "key-auth",
        },
      }),
    } as unknown as PushSubscription;

    expect(toWebPushSubscriptionPayload(subscription)).toEqual({
      endpoint: "https://example.com/push",
      expirationTime: null,
      keys: {
        p256dh: "key-p256dh",
        auth: "key-auth",
      },
    });
  });

  it("returns null when required keys are missing", () => {
    const subscription = {
      toJSON: () => ({
        endpoint: "https://example.com/push",
        keys: {
          p256dh: "",
          auth: "",
        },
      }),
    } as unknown as PushSubscription;

    expect(toWebPushSubscriptionPayload(subscription)).toBeNull();
  });
});
