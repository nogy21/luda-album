import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  isAdminAuthConfigured,
  validateAdminPassword,
} from "@/lib/admin/session";

type AuthPayload = {
  password?: string;
};

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json(
      { error: "관리자 인증이 아직 설정되지 않았어요." },
      { status: 503 },
    );
  }

  let payload: AuthPayload;

  try {
    payload = (await request.json()) as AuthPayload;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const password = payload.password ?? "";

  if (!validateAdminPassword(password)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않아요." }, { status: 401 });
  }

  const token = createAdminSessionToken();

  if (!token) {
    return NextResponse.json(
      { error: "관리자 세션을 만들지 못했어요." },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();

  cookieStore.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });

  return NextResponse.json({ authenticated: true });
}

