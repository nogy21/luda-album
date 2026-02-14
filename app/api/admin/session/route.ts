import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  return NextResponse.json({
    authenticated: verifyAdminSessionToken(token),
  });
}

