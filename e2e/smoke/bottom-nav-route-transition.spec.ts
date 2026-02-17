import { expect, test } from "@playwright/test";

import { dismissBlockingOverlays } from "./helpers";

test("bottom navigation route transitions keep primary landmarks", async ({ page }) => {
  await page.goto("/");
  await dismissBlockingOverlays(page);

  const bottomNav = page.getByRole("navigation", { name: "하단 메뉴" });
  await expect(bottomNav).toBeVisible();
  await expect(page.locator(".route-transition-layer")).toBeVisible();

  await bottomNav.getByRole("link", { name: "앨범" }).click();
  await expect(page).toHaveURL(/\/photos$/);
  await expect(page.getByRole("heading", { name: "요즘 루다는" })).toBeVisible();

  await bottomNav.getByRole("link", { name: "덕담" }).click();
  await expect(page).toHaveURL(/\/guestbook$/);
  await expect(page.getByRole("heading", { name: "덕담 남기기" })).toBeVisible();

  await bottomNav.getByRole("link", { name: "홈" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("루다는 오늘")).toBeVisible();
});

