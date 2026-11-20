import { expect, test } from "@playwright/test";

test("onboarding and a multi-item expense reach a real dashboard total", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByLabel("Your name").fill("Aarav Test");
  await page.getByLabel("Workspace name").fill("Playwright Brew");
  await page.getByRole("switch", { name: "Import the included 2026 tracker" }).click();
  await page.getByRole("button", { name: "Open my workspace" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Today’s spending")).toBeVisible();

  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Add expense" })
    .click();
  await expect(page).toHaveURL(/\/add$/);

  await page.getByRole("button", { name: /^Add Tea Medium,/ }).click();
  await page.getByRole("button", { name: /^Add Tea Medium,/ }).click();
  await page.getByRole("button", { name: /^Add Black Coffee,/ }).click();

  await expect(
    page.getByRole("region", { name: "Expense summary" }).getByText("₹56.00"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save expense" }).click();

  await expect(page.getByText("Expense saved", { exact: false })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Home" })
    .click();

  await expect(page.getByText("₹56.00", { exact: true }).first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.reload();
  await expect(page.getByText("₹56.00").first()).toBeVisible();
});
