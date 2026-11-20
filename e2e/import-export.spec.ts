import { expect, test } from "@playwright/test";

test("the real workbook imports once, blocks duplicates and exports its ledger", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your name").fill("Importer Test");
  await page.getByLabel("Workspace name").fill("Workbook Brew");
  await page.getByRole("button", { name: "Open my workspace" }).click();

  await expect(page).toHaveURL(/\/data/);
  await expect(page.getByText("₹7,660.00").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Import 158 rows" })).toBeEnabled();
  await page.getByRole("button", { name: "Import 158 rows" }).click();

  await expect(page.getByText("Import complete.")).toBeVisible();
  await expect(page.getByText("Imported 158 expenses.")).toBeVisible();
  await page.getByRole("link", { name: /View expenses/ }).click();
  await expect(page).toHaveURL(/\/expenses$/);
  const totals = page.getByRole("group", { name: "Expense totals" });
  await expect(totals).toContainText("₹7,660.00");
  await expect(totals).toContainText("158");

  await page.goto("/data");
  await page.getByRole("button", { name: "Preview tracker" }).click();
  await expect(page.getByRole("button", { name: "Import 0 rows" })).toBeDisabled({
    timeout: 15_000,
  });
  await expect(
    page.getByText("This row is already in your workspace from an earlier import.").first(),
  ).toBeVisible();

  await page
    .getByRole("group", { name: "Import or export" })
    .getByRole("button", { name: "Export" })
    .click();
  await expect(page.getByText("₹7,660.00").first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^dailybrew-all-\d{4}-\d{2}-\d{2}\.csv$/);

  const excelDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Excel" }).click();
  const excelDownload = await excelDownloadPromise;
  expect(excelDownload.suggestedFilename()).toMatch(/^dailybrew-all-\d{4}-\d{2}-\d{2}\.xlsx$/);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open print view" }).click();
  const popup = await popupPromise;
  await expect(popup.getByRole("heading", { name: "Expense report" })).toBeVisible();
  await expect(popup.getByText("Total spent")).toBeVisible();
  const printOverflow = await popup.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(printOverflow).toBeLessThanOrEqual(1);
  await expect(page.getByText("blocked the print view")).toHaveCount(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
