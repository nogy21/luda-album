import { describe, expect, test } from "vitest";

import {
  DEFAULT_GUESTBOOK_NICKNAME,
  MAX_GUESTBOOK_MESSAGE_LENGTH,
  validateGuestbookInput,
} from "./validation";

describe("validateGuestbookInput", () => {
  test("rejects an empty message", () => {
    const result = validateGuestbookInput({
      nickname: "가족",
      message: "   ",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected validation to fail");
    }
    expect(result.error).toBe("덕담 내용을 입력해 주세요.");
  });

  test("maps empty nickname to default", () => {
    const result = validateGuestbookInput({
      nickname: "   ",
      message: "루다야 건강하게 자라렴",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected validation to pass");
    }
    expect(result.data.nickname).toBe(DEFAULT_GUESTBOOK_NICKNAME);
  });

  test("rejects a message that exceeds max length", () => {
    const result = validateGuestbookInput({
      nickname: "가족",
      message: "a".repeat(MAX_GUESTBOOK_MESSAGE_LENGTH + 1),
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected validation to fail");
    }
    expect(result.error).toBe(`덕담은 ${MAX_GUESTBOOK_MESSAGE_LENGTH}자 이하로 작성해 주세요.`);
  });
});
