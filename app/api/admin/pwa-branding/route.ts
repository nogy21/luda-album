import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import sharp from "sharp";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin/session";
import {
  buildDefaultPwaBranding,
  clearPwaBrandingFromDatabase,
  readPwaBrandingFromDatabase,
  savePwaBrandingToDatabase,
  type PwaIconVariant,
} from "@/lib/pwa/branding";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_STORAGE_BUCKET = "luda-photos";

const variantToFileName: Record<PwaIconVariant, string> = {
  icon192: "icon-192.png",
  icon512: "icon-512.png",
  maskable512: "maskable-512.png",
  appleTouch: "apple-touch-icon.png",
};

const isMissingStorageObjectError = (message: string) => {
  return /not found|no such object/i.test(message);
};

const isMissingSettingsTableError = (message: string) => {
  return (
    /app_settings/i.test(message) &&
    (/does not exist/i.test(message) ||
      /schema cache/i.test(message) ||
      /could not find the table/i.test(message))
  );
};

const toReadableErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  if (isMissingSettingsTableError(error.message)) {
    return "앱 설정 테이블이 필요해요. docs/db/2026-02-16-app-settings-pwa-branding.sql을 먼저 적용해 주세요.";
  }

  return error.message;
};

const buildBrandingRootPath = () => {
  const datePath = new Date().toISOString().slice(0, 10).replaceAll("-", "/");
  return `branding/pwa/${datePath}/${crypto.randomUUID()}`;
};

const buildSquareIcon = async (input: Buffer, size: number) => {
  return sharp(input)
    .rotate()
    .resize(size, size, {
      fit: "cover",
      position: "attention",
    })
    .png()
    .toBuffer();
};

const buildMaskableIcon = async (input: Buffer) => {
  const canvasSize = 512;
  const innerSize = 410;
  const inset = Math.floor((canvasSize - innerSize) / 2);
  const inner = await buildSquareIcon(input, innerSize);

  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: inner,
        top: inset,
        left: inset,
      },
    ])
    .png()
    .toBuffer();
};

const buildPwaIconBuffers = async (input: Buffer) => {
  const metadata = await sharp(input).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("이미지 크기를 읽을 수 없어요.");
  }

  return {
    icon192: await buildSquareIcon(input, 192),
    icon512: await buildSquareIcon(input, 512),
    maskable512: await buildMaskableIcon(input),
    appleTouch: await buildSquareIcon(input, 180),
  };
};

const removeStoragePaths = async (
  supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  bucket: string,
  paths: string[],
) => {
  if (paths.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from(bucket).remove(paths);

  if (!error) {
    return;
  }

  if (isMissingStorageObjectError(error.message ?? "")) {
    return;
  }

  throw new Error(`기존 아이콘 파일 정리에 실패했어요: ${error.message}`);
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

export async function GET() {
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
    const branding = await readPwaBrandingFromDatabase(supabase);
    return NextResponse.json(
      { branding },
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
          message: toReadableErrorMessage(
            error,
            "앱 아이콘 설정을 불러오지 못했어요.",
          ),
        },
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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

  const formData = await request.formData();
  const logo = formData.get("logo");

  if (!(logo instanceof File)) {
    return NextResponse.json(
      { error: { message: "업로드할 로고 파일을 선택해 주세요." } },
      { status: 400 },
    );
  }

  if (!logo.type.startsWith("image/")) {
    return NextResponse.json(
      { error: { message: "이미지 파일만 업로드할 수 있어요." } },
      { status: 400 },
    );
  }

  if (logo.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { error: { message: "로고 파일 크기는 10MB 이하여야 해요." } },
      { status: 400 },
    );
  }

  let buffers: Awaited<ReturnType<typeof buildPwaIconBuffers>>;
  try {
    const sourceBuffer = Buffer.from(await logo.arrayBuffer());
    buffers = await buildPwaIconBuffers(sourceBuffer);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? `이미지를 처리하지 못했어요: ${error.message}`
              : "이미지를 처리하지 못했어요.",
        },
      },
      { status: 400 },
    );
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? DEFAULT_STORAGE_BUCKET;
  const rootPath = buildBrandingRootPath();
  const targetPaths: Record<PwaIconVariant, string> = {
    icon192: `${rootPath}/${variantToFileName.icon192}`,
    icon512: `${rootPath}/${variantToFileName.icon512}`,
    maskable512: `${rootPath}/${variantToFileName.maskable512}`,
    appleTouch: `${rootPath}/${variantToFileName.appleTouch}`,
  };

  const uploadedPaths: string[] = [];
  const uploadedUrls: Partial<Record<PwaIconVariant, string>> = {};
  let previousStoragePaths: string[] = [];

  try {
    const previousBranding = await readPwaBrandingFromDatabase(supabase);
    previousStoragePaths = previousBranding.storagePaths;
  } catch {
    previousStoragePaths = [];
  }

  try {
    const uploadOrder: PwaIconVariant[] = ["icon192", "icon512", "maskable512", "appleTouch"];

    for (const variant of uploadOrder) {
      const path = targetPaths[variant];
      const { error } = await supabase.storage.from(bucket).upload(path, buffers[variant], {
        upsert: false,
        contentType: "image/png",
        cacheControl: "31536000",
      });

      if (error) {
        throw new Error(`아이콘 업로드에 실패했어요: ${error.message}`);
      }

      uploadedPaths.push(path);

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);

      if (!publicUrl) {
        throw new Error("아이콘 공개 URL 생성에 실패했어요.");
      }

      uploadedUrls[variant] = publicUrl;
    }

    const saved = await savePwaBrandingToDatabase(supabase, {
      icons: {
        icon192: {
          url: uploadedUrls.icon192!,
          storagePath: targetPaths.icon192,
        },
        icon512: {
          url: uploadedUrls.icon512!,
          storagePath: targetPaths.icon512,
        },
        maskable512: {
          url: uploadedUrls.maskable512!,
          storagePath: targetPaths.maskable512,
        },
        appleTouch: {
          url: uploadedUrls.appleTouch!,
          storagePath: targetPaths.appleTouch,
        },
      },
    });

    const stalePaths = previousStoragePaths.filter((path) => !uploadedPaths.includes(path));
    try {
      await removeStoragePaths(supabase, bucket, stalePaths);
    } catch {
      // Keep success response even if old files cleanup fails.
    }

    return NextResponse.json({ branding: saved });
  } catch (error) {
    try {
      await removeStoragePaths(supabase, bucket, uploadedPaths);
    } catch {
      // Keep original error response.
    }

    return NextResponse.json(
      {
        error: {
          message: toReadableErrorMessage(error, "앱 아이콘 저장에 실패했어요."),
        },
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
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

  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? DEFAULT_STORAGE_BUCKET;

  try {
    const existing = await readPwaBrandingFromDatabase(supabase);
    await clearPwaBrandingFromDatabase(supabase);
    await removeStoragePaths(supabase, bucket, existing.storagePaths);

    return NextResponse.json({ branding: buildDefaultPwaBranding() });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message: toReadableErrorMessage(
            error,
            "앱 아이콘 설정을 초기화하지 못했어요.",
          ),
        },
      },
      { status: 500 },
    );
  }
}
