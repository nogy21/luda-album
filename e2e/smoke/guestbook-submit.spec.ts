import { expect, test } from "@playwright/test";

import { dismissBlockingOverlays } from "./helpers";

test("guestbook submit works and shows validation errors on mobile", async ({ page }) => {
  await page.goto("/guestbook");
  await dismissBlockingOverlays(page);

  const messageInput = page.getByPlaceholder("루다에게 전하고 싶은 말을 적어주세요.");
  await expect(messageInput).toBeVisible();

  const message = "e2e 모바일 덕담";
  await page.getByPlaceholder("닉네임 (비우면 익명의 팬)").fill("테스트");
  await messageInput.fill(message);
  await page.getByRole("button", { name: "남기기" }).click();

  await expect(
    page.locator("p[role='status']").filter({ hasText: "덕담이 등록되었어요." }),
  ).toBeVisible();
  await expect(page.getByText(message)).toBeVisible();

  await messageInput.fill("   ");
  await page.getByRole("button", { name: "남기기" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "덕담 내용을 입력해 주세요." }),
  ).toBeVisible();
});
