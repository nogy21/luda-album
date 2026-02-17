import type { Page } from "@playwright/test";

export const dismissBlockingOverlays = async (page: Page) => {
  const collapseDevIssueBadge = page.getByRole("button", { name: "Collapse issues badge" });
  if (await collapseDevIssueBadge.isVisible().catch(() => false)) {
    await collapseDevIssueBadge.click().catch(() => undefined);
  }

  const onboardingDialog = page.getByRole("dialog", { name: "사용 가이드" });

  if (await onboardingDialog.isVisible().catch(() => false)) {
    const laterButton = onboardingDialog.getByRole("button", { name: "나중에 보기" });
    if (await laterButton.isVisible().catch(() => false)) {
      await laterButton.click();
    }
  }

  const photoNoticeDialog = page.getByRole("dialog", { name: "새 사진 알림" });

  if (await photoNoticeDialog.isVisible().catch(() => false)) {
    const laterButton = photoNoticeDialog.getByRole("button", { name: "나중에" });
    if (await laterButton.isVisible().catch(() => false)) {
      await laterButton.click();
    }
  }
};
