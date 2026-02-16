import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin/session";
import { parseEventNamesPayload } from "@/lib/gallery/event-names";
import { createGalleryImageRecord } from "@/lib/gallery/repository";
import { extractPhotoUploadMetadata } from "@/lib/gallery/upload-metadata";
import type { PhotoVisibility } from "@/lib/gallery/types";
import { notifyUploadedFamilyPhotos } from "@/lib/notifications/web-push";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_CAPTION_LENGTH = 120;

const sanitizeFileName = (name: string) => {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
};

const buildUploadPath = (fileName: string) => {
  const datePath = new Date().toISOString().slice(0, 10).replaceAll("-", "/");
  return `${datePath}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
};

const normalizeVisibility = (value: FormDataEntryValue | null): PhotoVisibility => {
  if (typeof value === "string" && value === "admin") {
    return "admin";
  }

  return "family";
};

const parseRequestedCaption = (value: FormDataEntryValue | null) => {
  if (value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("caption은 문자열이어야 해요.");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("caption은 비워둘 수 없어요.");
  }

  if (trimmed.length > MAX_CAPTION_LENGTH) {
    throw new Error(`caption은 ${MAX_CAPTION_LENGTH}자 이하여야 해요.`);
  }

  return trimmed;
};

const parseRequestedTakenAt = (value: FormDataEntryValue | null) => {
  if (value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("takenAt은 문자열이어야 해요.");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("takenAt 형식이 올바르지 않아요.");
  }

  return parsed.toISOString();
};

const parseRequestedEventNames = (value: FormDataEntryValue | null) => {
  if (value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("eventNames는 JSON 문자열이어야 해요.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("eventNames JSON 형식이 올바르지 않아요.");
  }

  const validation = parseEventNamesPayload(parsed);

  if ("error" in validation) {
    throw new Error(validation.error);
  }

  return validation.eventNames ?? [];
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json(
      { error: { message: "관리자 인증이 필요해요." } },
      { status: 401 },
    );
  }

  const formData = await request.formData();
  const visibility = normalizeVisibility(formData.get("visibility"));
  let requestedCaption: string | undefined;
  let requestedTakenAt: string | undefined;
  let requestedEventNames: string[] | undefined;
  try {
    requestedCaption = parseRequestedCaption(formData.get("caption"));
    requestedTakenAt = parseRequestedTakenAt(formData.get("takenAt"));
    requestedEventNames = parseRequestedEventNames(formData.get("eventNames"));
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error ? error.message : "업로드 메타데이터 형식이 올바르지 않아요.",
        },
      },
      { status: 400 },
    );
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json(
      { error: { message: "업로드할 이미지를 선택해 주세요." } },
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

  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "luda-photos";
  const uploaded: Array<{
    id: string;
    name: string;
    path: string;
    src: string;
    thumbSrc: string | null;
    visibility: PhotoVisibility;
    size: number;
    type: string;
  }> = [];
  const failed: Array<{
    name: string;
    reason: string;
    size: number;
    type: string;
  }> = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      failed.push({
        name: file.name,
        reason: "이미지 파일만 업로드할 수 있어요.",
        size: file.size,
        type: file.type,
      });
      continue;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      failed.push({
        name: file.name,
        reason: "파일 크기는 15MB 이하여야 해요.",
        size: file.size,
        type: file.type,
      });
      continue;
    }

    const path = buildUploadPath(file.name);
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "31536000",
    });

    if (error) {
      failed.push({
        name: file.name,
        reason: error.message || "업로드에 실패했어요.",
        size: file.size,
        type: file.type,
      });
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    if (!publicUrl) {
      await supabase.storage.from(bucket).remove([path]);
      failed.push({
        name: file.name,
        reason: "공개 URL 생성에 실패했어요.",
        size: file.size,
        type: file.type,
      });
      continue;
    }

    try {
      const metadata = await extractPhotoUploadMetadata(file);
      const caption = requestedCaption ?? metadata.caption;
      const takenAt = requestedTakenAt ?? metadata.takenAt;
      const created = await createGalleryImageRecord(supabase, {
        src: publicUrl,
        thumbSrc: publicUrl,
        storagePath: path,
        originalName: file.name,
        type: file.type,
        size: file.size,
        caption,
        alt: `${caption} 사진`,
        takenAt,
        eventNames: requestedEventNames,
        visibility,
      });

      uploaded.push({
        id: created.id,
        name: file.name,
        path,
        src: publicUrl,
        thumbSrc: created.thumbSrc,
        visibility: created.visibility,
        size: file.size,
        type: file.type,
      });
    } catch (recordError) {
      await supabase.storage.from(bucket).remove([path]);
      failed.push({
        name: file.name,
        reason:
          recordError instanceof Error
            ? `DB 기록 실패: ${recordError.message}`
            : "DB 기록에 실패했어요.",
        size: file.size,
        type: file.type,
      });
      continue;
    }

  }

  const uploadedFamilyCount = uploaded.filter((item) => item.visibility === "family").length;

  if (uploadedFamilyCount > 0) {
    try {
      await notifyUploadedFamilyPhotos(supabase, uploadedFamilyCount);
    } catch {
      // Keep upload success even if push broadcast fails.
    }
  }

  return NextResponse.json({
    total: files.length,
    successCount: uploaded.length,
    failureCount: failed.length,
    uploaded,
    failed,
  });
}
