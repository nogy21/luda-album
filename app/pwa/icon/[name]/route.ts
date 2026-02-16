import { NextResponse } from "next/server";

import {
  DEFAULT_PWA_ICON_PATHS,
  resolvePwaBranding,
  type PwaIconVariant,
} from "@/lib/pwa/branding";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const revalidate = 0;

const nameToVariant: Record<string, PwaIconVariant> = {
  "192.png": "icon192",
  "512.png": "icon512",
  "maskable-512.png": "maskable512",
  "apple-touch-icon.png": "appleTouch",
};

export async function GET(
  request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  const variant = nameToVariant[name];

  if (!variant) {
    return NextResponse.json(
      { error: { message: "요청한 아이콘을 찾지 못했어요." } },
      { status: 404 },
    );
  }

  const supabase = createServerSupabaseClient();
  const branding = await resolvePwaBranding(supabase);
  const baseUrl = branding.icons[variant] ?? DEFAULT_PWA_ICON_PATHS[variant];

  return NextResponse.redirect(new URL(baseUrl, request.url), {
    status: 307,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
