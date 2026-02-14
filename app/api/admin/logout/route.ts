import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE } from "@/lib/admin/session";

export async function POST() {
  const cookieStore = await cookies();

  cookieStore.delete(ADMIN_SESSION_COOKIE);

  return NextResponse.json({ authenticated: false });
}

