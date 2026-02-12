import type { CreateGuestbookPayload, ValidGuestbookPayload } from "./types";

export const DEFAULT_GUESTBOOK_NICKNAME = "익명의 팬";
export const MAX_GUESTBOOK_MESSAGE_LENGTH = 300;

export type GuestbookValidationResult =
  | { success: true; data: ValidGuestbookPayload }
  | { success: false; error: string };

const normalizeNickname = (nickname?: string | null): string => {
  const trimmedNickname = nickname?.trim() ?? "";
  return trimmedNickname || DEFAULT_GUESTBOOK_NICKNAME;
};

export const validateGuestbookInput = (
  payload: CreateGuestbookPayload,
): GuestbookValidationResult => {
  const message = payload.message.trim();

  if (!message) {
    return { success: false, error: "덕담 내용을 입력해 주세요." };
  }

  if (message.length > MAX_GUESTBOOK_MESSAGE_LENGTH) {
    return {
      success: false,
      error: `덕담은 ${MAX_GUESTBOOK_MESSAGE_LENGTH}자 이하로 작성해 주세요.`,
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
