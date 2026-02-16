import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin/session";
import { parseEventNamesPayload } from "@/lib/gallery/event-names";
import {
  deleteGalleryPhotoRecord,
  getGalleryPhotosTableName,
  updateGalleryPhotoMetadata,
} from "@/lib/gallery/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PatchBody = {
  caption?: string;
  takenAt?: string;
  isFeatured?: boolean;
  featuredRank?: number | null;
  eventNames?: unknown;
};

const MAX_CAPTION_LENGTH = 120;

const parsePatchBody = (body: PatchBody) => {
  const patch: {
    caption?: string;
    takenAt?: string;
    isFeatured?: boolean;
    featuredRank?: number | null;
    eventNames?: string[];
  } = {};

  if (body.caption !== undefined) {
    if (typeof body.caption !== "string") {
      return { error: "caption은 문자열이어야 해요." };
    }
    const trimmed = body.caption.trim();
    if (!trimmed) {
      return { error: "caption은 비워둘 수 없어요." };
    }
    if (trimmed.length > MAX_CAPTION_LENGTH) {
      return { error: `caption은 ${MAX_CAPTION_LENGTH}자 이하여야 해요.` };
    }
    patch.caption = trimmed;
  }

  if (body.takenAt !== undefined) {
    if (typeof body.takenAt !== "string") {
      return { error: "takenAt은 문자열이어야 해요." };
    }
    const parsedDate = new Date(body.takenAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "takenAt 형식이 올바르지 않아요." };
    }
    patch.takenAt = parsedDate.toISOString();
  }

  if (body.isFeatured !== undefined) {
    if (typeof body.isFeatured !== "boolean") {
      return { error: "isFeatured(boolean) 값이 필요해요." };
    }
    patch.isFeatured = body.isFeatured;
  }

  if (body.featuredRank !== undefined) {
    if (body.featuredRank !== null && typeof body.featuredRank !== "number") {
      return { error: "featuredRank는 number 또는 null 이어야 해요." };
    }
    patch.featuredRank = body.featuredRank;
  }

  if (body.eventNames !== undefined) {
    const parsedEventNames = parseEventNamesPayload(body.eventNames);

    if ("error" in parsedEventNames) {
      return { error: parsedEventNames.error };
    }

    patch.eventNames = parsedEventNames.eventNames ?? [];
  }

  if (Object.keys(patch).length === 0) {
    return { error: "수정할 필드를 최소 하나 이상 전달해 주세요." };
  }

  return { patch };
};

const getAuthorizedSupabase = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!verifyAdminSessionToken(token)) {
    return {
      errorResponse: NextResponse.json(
        { error: { message: "관리자 인증이 필요해요." } },
        { status: 401 },
      ),
      supabase: null,
    };
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return {
      errorResponse: NextResponse.json(
        { error: { message: "Supabase 연결이 설정되지 않았어요." } },
        { status: 503 },
      ),
      supabase: null,
    };
  }

  return { errorResponse: null, supabase };
};

const getPhotoIdOrErrorResponse = (photoId: string | undefined) => {
  if (!photoId) {
    return NextResponse.json(
      { error: { message: "photoId가 필요해요." } },
      { status: 400 },
    );
  }

  return null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await context.params;
  const photoIdErrorResponse = getPhotoIdOrErrorResponse(photoId);
  if (photoIdErrorResponse) {
    return photoIdErrorResponse;
  }

  const { errorResponse, supabase } = await getAuthorizedSupabase();
  if (errorResponse) {
    return errorResponse;
  }
  if (!supabase) {
    return NextResponse.json(
      { error: { message: "Supabase 연결이 설정되지 않았어요." } },
      { status: 503 },
    );
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: { message: "요청 본문(JSON) 형식이 올바르지 않아요." } },
      { status: 400 },
    );
  }
  const parsed = parsePatchBody(body);

  if ("error" in parsed) {
    return NextResponse.json(
      { error: { message: parsed.error } },
      { status: 400 },
    );
  }

  try {
    const updated = await updateGalleryPhotoMetadata(supabase, {
      photoId,
      caption: parsed.patch.caption,
      takenAt: parsed.patch.takenAt,
      isFeatured: parsed.patch.isFeatured,
      featuredRank: parsed.patch.featuredRank,
      eventNames: parsed.patch.eventNames,
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
              message:
            error instanceof Error
              ? error.message
              : "사진 정보를 저장하지 못했어요.",
        },
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await context.params;
  const photoIdErrorResponse = getPhotoIdOrErrorResponse(photoId);
  if (photoIdErrorResponse) {
    return photoIdErrorResponse;
  }

  const { errorResponse, supabase } = await getAuthorizedSupabase();
  if (errorResponse) {
    return errorResponse;
  }
  if (!supabase) {
    return NextResponse.json(
      { error: { message: "Supabase 연결이 설정되지 않았어요." } },
      { status: 503 },
    );
  }

  try {
    const tableName = getGalleryPhotosTableName();
    const { data: existing, error: existingError } = await supabase
      .from(tableName)
      .select("id, storage_path")
      .eq("id", photoId)
      .single();

    if (existingError || !existing) {
      const errorMessage = existingError?.message ?? "";
      const isNotFound = /no rows|0 rows|not found/i.test(errorMessage);
      return NextResponse.json(
        {
          error: {
            message:
              isNotFound
                ? "삭제할 사진 정보를 찾지 못했어요."
                : existingError?.message ?? "삭제할 사진 정보를 조회하지 못했어요.",
          },
        },
        { status: isNotFound ? 404 : 500 },
      );
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "luda-photos";
    const storagePath =
      typeof existing.storage_path === "string" ? existing.storage_path : null;

    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([storagePath]);

      if (storageError) {
        const message = storageError.message ?? "Storage 파일 삭제에 실패했어요.";
        const isMissingObject = /not found|no such object/i.test(message);

        if (!isMissingObject) {
          return NextResponse.json(
            {
              error: {
                message: `Storage 파일 삭제에 실패했어요: ${message}`,
              },
            },
            { status: 500 },
          );
        }
      }
    }

    const deleted = await deleteGalleryPhotoRecord(supabase, { photoId }, tableName);

    return NextResponse.json({
      ok: true,
      deletedPhotoId: deleted.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : "사진 삭제를 완료하지 못했어요.",
        },
      },
      { status: 500 },
    );
  }
}
