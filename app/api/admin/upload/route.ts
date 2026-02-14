import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

const sanitizeFileName = (name: string) => {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
};

const buildUploadPath = (fileName: string) => {
  const datePath = new Date().toISOString().slice(0, 10).replaceAll("-", "/");
  return `${datePath}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
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
    name: string;
    path: string;
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
      cacheControl: "3600",
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

    uploaded.push({
      name: file.name,
      path,
      size: file.size,
      type: file.type,
    });
  }

  return NextResponse.json({
    total: files.length,
    successCount: uploaded.length,
    failureCount: failed.length,
    uploaded,
    failed,
  });
}

