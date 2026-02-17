import { expect, test } from "@playwright/test";

import { dismissBlockingOverlays } from "./helpers";

test("mobile lightbox supports immersive photo-only flow", async ({ page }) => {
  await page.goto("/");
  await dismissBlockingOverlays(page);

  const openButtons = page.getByRole("button", { name: /확대 보기/ });
  await expect(openButtons.first()).toBeVisible();
  await openButtons.first().click();

  const lightboxDialog = page.getByRole("dialog", { name: "요즘 루다 사진" });
  await expect(lightboxDialog).toBeVisible();
  await expect(page.getByRole("button", { name: "전체화면" })).toBeVisible();

  await page.getByRole("button", { name: "전체화면" }).click();

  await expect(page.getByRole("button", { name: "전체화면 종료" })).toBeVisible();
  await expect(page.getByRole("link", { name: "이동하기" })).toHaveCount(0);

  const nextButton = page.getByRole("button", { name: "다음 사진" });
  if ((await nextButton.count()) > 0) {
    await nextButton.first().click();
  }

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "전체화면" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(lightboxDialog).toHaveCount(0);
});
