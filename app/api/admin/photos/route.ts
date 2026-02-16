import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin/session";
import { listAdminPhotosPageFromDatabase } from "@/lib/gallery/repository";
import type { PhotoVisibility } from "@/lib/gallery/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 96;

const parseIntegerParam = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
};

const clampLimit = (value?: number) => {
  if (typeof value !== "number") {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, value));
};

const parseVisibility = (value: string | null): PhotoVisibility | null | undefined => {
  if (!value) {
    return undefined;
  }

  if (value === "family" || value === "admin") {
    return value;
  }

  return null;
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
  const cursor = searchParams.get("cursor") ?? undefined;
  const limitParam = parseIntegerParam(searchParams.get("limit"));
  const visibility = parseVisibility(searchParams.get("visibility"));

  if (limitParam === null) {
    return NextResponse.json(
      { error: { message: "limit 파라미터가 올바르지 않아요." } },
      { status: 400 },
    );
  }

  if (visibility === null) {
    return NextResponse.json(
      { error: { message: "visibility는 family 또는 admin 이어야 해요." } },
      { status: 400 },
    );
  }

  try {
    const response = await listAdminPhotosPageFromDatabase(
      supabase,
      {
        cursor,
        limit: clampLimit(limitParam),
        visibility,
      },
    );

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : "관리자 사진 목록을 불러오지 못했어요.",
        },
      },
      { status: 500 },
    );
  }
}
