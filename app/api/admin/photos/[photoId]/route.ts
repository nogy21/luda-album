import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin/session";
import { updateGalleryPhotoFeatured } from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PatchBody = {
  isFeatured?: boolean;
  featuredRank?: number | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ photoId: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json(
      { error: { message: "관리자 인증이 필요해요." } },
      { status: 401 },
    );
  }

  const { photoId } = await context.params;

  if (!photoId) {
    return NextResponse.json(
      { error: { message: "photoId가 필요해요." } },
      { status: 400 },
    );
  }

  const body = (await request.json()) as PatchBody;

  if (typeof body.isFeatured !== "boolean") {
    return NextResponse.json(
      { error: { message: "isFeatured(boolean) 값이 필요해요." } },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { error: { message: "Supabase 연결이 설정되지 않았어요." } },
      { status: 503 },
    );
  }

  try {
    const updated = await updateGalleryPhotoFeatured(supabase, {
      photoId,
      isFeatured: body.isFeatured,
      featuredRank: typeof body.featuredRank === "number" ? body.featuredRank : null,
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : "대표컷 설정을 저장하지 못했어요.",
        },
      },
      { status: 500 },
    );
  }
}
