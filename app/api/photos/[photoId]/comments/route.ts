import { NextResponse } from "next/server";

import {
  createPhotoComment,
  listPhotoComments,
} from "@/lib/gallery/comment-repository";
import type {
  CreatePhotoCommentPayload,
  PhotoCommentRow,
} from "@/lib/gallery/comment-types";
import {
  DEFAULT_PHOTO_COMMENT_NICKNAME,
  validatePhotoCommentInput,
} from "@/lib/gallery/comment-validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const fallbackPhotoComments: Record<string, PhotoCommentRow[]> = {};

const getFallbackComments = (photoId: string) => {
  return fallbackPhotoComments[photoId] ?? [];
};

const createFallbackComment = (
  photoId: string,
  payload: CreatePhotoCommentPayload,
): PhotoCommentRow => {
  return {
    id: crypto.randomUUID(),
    photo_id: photoId,
    nickname: payload.nickname?.trim() || DEFAULT_PHOTO_COMMENT_NICKNAME,
    message: payload.message.trim(),
    created_at: new Date().toISOString(),
  };
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await context.params;

  if (!photoId) {
    return NextResponse.json({ error: "photoId가 필요해요." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ items: getFallbackComments(photoId) });
  }

  const repositoryClient = supabase as unknown as Parameters<typeof listPhotoComments>[0];

  try {
    const items = await listPhotoComments(repositoryClient, photoId);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: getFallbackComments(photoId) });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await context.params;

  if (!photoId) {
    return NextResponse.json({ error: "photoId가 필요해요." }, { status: 400 });
  }

  let payload: CreatePhotoCommentPayload;

  try {
    payload = (await request.json()) as CreatePhotoCommentPayload;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const validation = validatePhotoCommentInput(payload);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    const created = createFallbackComment(photoId, validation.data);
    fallbackPhotoComments[photoId] = [created, ...getFallbackComments(photoId)];
    return NextResponse.json(created, { status: 201 });
  }

  const repositoryClient = supabase as unknown as Parameters<typeof createPhotoComment>[0];

  try {
    const created = await createPhotoComment(repositoryClient, photoId, validation.data);
    return NextResponse.json(created, { status: 201 });
  } catch {
    const created = createFallbackComment(photoId, validation.data);
    fallbackPhotoComments[photoId] = [created, ...getFallbackComments(photoId)];
    return NextResponse.json(created, { status: 201 });
  }
}
