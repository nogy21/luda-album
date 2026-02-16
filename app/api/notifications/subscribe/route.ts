import { NextResponse } from "next/server";

import {
  deleteWebPushSubscription,
  upsertWebPushSubscription,
} from "@/lib/notifications/repository";
import {
  isWebPushConfigured,
  sendWebPushNotification,
} from "@/lib/notifications/web-push";
import type { WebPushSubscriptionPayload } from "@/lib/notifications/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const parseWebPushSubscription = (payload: unknown): WebPushSubscriptionPayload | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as {
    endpoint?: unknown;
    expirationTime?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  const endpoint = typeof record.endpoint === "string" ? record.endpoint : "";
  const p256dh =
    typeof record.keys?.p256dh === "string" ? record.keys.p256dh : "";
  const auth = typeof record.keys?.auth === "string" ? record.keys.auth : "";

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    expirationTime:
      typeof record.expirationTime === "number" ? record.expirationTime : null,
    keys: {
      p256dh,
      auth,
    },
  };
};

const getPushErrorStatusCode = (error: unknown): number | null => {
  if (!error || typeof error !== "object" || !("statusCode" in error)) {
    return null;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : null;
};

export async function POST(request: Request) {
  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "웹 푸시 설정이 아직 완료되지 않았어요." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const subscription = parseWebPushSubscription(body);

  if (!subscription) {
    return NextResponse.json(
      { error: "유효한 구독 정보가 필요해요." },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "알림 저장소 연결이 설정되지 않았어요." },
      { status: 503 },
    );
  }

  try {
    await upsertWebPushSubscription(supabase, subscription);

    await sendWebPushNotification(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      {
        title: "루다 앨범",
        body: "알림 설정이 완료됐어요.",
        icon: "/pwa/icon/192.png",
        badge: "/icons/badge-72.png",
        tag: "luda-album-subscribe",
        url: "/photos",
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const statusCode = getPushErrorStatusCode(error);

    if (statusCode === 404 || statusCode === 410) {
      try {
        await deleteWebPushSubscription(supabase, subscription.endpoint);
      } catch {
        // Keep the original error response even if cleanup fails.
      }
    }

    return NextResponse.json(
      { error: "알림 구독 저장에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const endpoint =
    body && typeof body === "object" && "endpoint" in body && typeof body.endpoint === "string"
      ? body.endpoint
      : "";

  if (!endpoint) {
    return NextResponse.json(
      { error: "해제할 구독 정보가 필요해요." },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ ok: true });
  }

  try {
    await deleteWebPushSubscription(supabase, endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "알림 구독 해제에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
