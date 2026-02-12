import { NextResponse } from "next/server";

import { createGuestbookMessage, listGuestbookMessages } from "@/lib/guestbook/repository";
import type { CreateGuestbookPayload, GuestbookRow } from "@/lib/guestbook/types";
import {
  DEFAULT_GUESTBOOK_NICKNAME,
  validateGuestbookInput,
} from "@/lib/guestbook/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const fallbackMessages: GuestbookRow[] = [
  {
    id: "seed-2",
    nickname: "할머니",
    message: "루다야 첫 설날 축하해. 건강하고 밝게 자라자.",
    created_at: new Date("2026-02-12T10:00:00.000Z").toISOString(),
  },
  {
    id: "seed-1",
    nickname: "이모",
    message: "우리 조카 새해 복 많이 받아. 사랑해!",
    created_at: new Date("2026-02-11T10:00:00.000Z").toISOString(),
  },
];

const toFallbackMessage = (payload: CreateGuestbookPayload): GuestbookRow => {
  return {
    id: crypto.randomUUID(),
    nickname: payload.nickname?.trim() || DEFAULT_GUESTBOOK_NICKNAME,
    message: payload.message.trim(),
    created_at: new Date().toISOString(),
  };
};

export async function GET() {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(fallbackMessages);
  }

  try {
    const messages = await listGuestbookMessages(supabase);
    return NextResponse.json(messages);
  } catch {
    return NextResponse.json(
      { error: "덕담 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let payload: CreateGuestbookPayload;

  try {
    payload = (await request.json()) as CreateGuestbookPayload;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const validation = validateGuestbookInput(payload);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    const created = toFallbackMessage(validation.data);
    fallbackMessages.unshift(created);
    return NextResponse.json(created, { status: 201 });
  }

  try {
    const created = await createGuestbookMessage(supabase, validation.data);
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "덕담 저장에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
