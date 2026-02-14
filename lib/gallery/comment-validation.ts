import type {
  CreatePhotoCommentPayload,
  ValidPhotoCommentPayload,
} from "./comment-types";

export const DEFAULT_PHOTO_COMMENT_NICKNAME = "익명의 팬";
export const MAX_PHOTO_COMMENT_LENGTH = 300;

export type PhotoCommentValidationResult =
  | { success: true; data: ValidPhotoCommentPayload }
  | { success: false; error: string };

const normalizeNickname = (nickname?: string | null): string => {
  const trimmed = nickname?.trim() ?? "";
  return trimmed || DEFAULT_PHOTO_COMMENT_NICKNAME;
};

export const validatePhotoCommentInput = (
  payload: CreatePhotoCommentPayload,
): PhotoCommentValidationResult => {
  const message = payload.message.trim();

  if (!message) {
    return {
      success: false,
      error: "댓글 내용을 입력해 주세요.",
    };
  }

  if (message.length > MAX_PHOTO_COMMENT_LENGTH) {
    return {
      success: false,
      error: `댓글은 ${MAX_PHOTO_COMMENT_LENGTH}자 이하로 작성해 주세요.`,
    };
  }

  return {
    success: true,
    data: {
      nickname: normalizeNickname(payload.nickname),
      message,
    },
  };
};
