import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin/session";
import { listEventSuggestions } from "@/lib/gallery/events-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

const parseLimit = (value: string | null) => {
  if (!value) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.min(MAX_LIMIT, Math.max(1, parsed));
};

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json(
      { error: { message: "관리자 인증이 필요해요." } },
      { status: 401 },
    );
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { error: { message: "Supabase 연결이 설정되지 않았어요." } },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const limit = parseLimit(searchParams.get("limit"));

  if (limit === null) {
    return NextResponse.json(
      { error: { message: "limit 파라미터가 올바르지 않아요." } },
      { status: 400 },
    );
  }

  try {
    const items = await listEventSuggestions(supabase, query, limit);

    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : "이벤트 자동완성 목록을 불러오지 못했어요.",
        },
      },
      { status: 500 },
    );
  }
}
