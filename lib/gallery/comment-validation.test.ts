import { describe, expect, test } from "vitest";

import {
  DEFAULT_PHOTO_COMMENT_NICKNAME,
  MAX_PHOTO_COMMENT_LENGTH,
  validatePhotoCommentInput,
} from "./comment-validation";

describe("validatePhotoCommentInput", () => {
  test("rejects empty message", () => {
    const result = validatePhotoCommentInput({ message: "   " });

    expect(result).toEqual({
      success: false,
      error: "댓글 내용을 입력해 주세요.",
    });
  });

  test("normalizes nickname and trims message", () => {
    const result = validatePhotoCommentInput({
      nickname: "  ",
      message: "  안녕 루다  ",
    });

    expect(result).toEqual({
      success: true,
      data: {
        nickname: DEFAULT_PHOTO_COMMENT_NICKNAME,
        message: "안녕 루다",
      },
    });
  });

  test("rejects too long message", () => {
    const result = validatePhotoCommentInput({
      message: "a".repeat(MAX_PHOTO_COMMENT_LENGTH + 1),
    });

    expect(result).toEqual({
      success: false,
      error: `댓글은 ${MAX_PHOTO_COMMENT_LENGTH}자 이하로 작성해 주세요.`,
    });
  });
});
