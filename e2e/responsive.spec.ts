import { expect, test } from "@playwright/test";

const widths = [320, 360, 375, 390, 402, 430, 768, 1024, 1440];

test("core screens never scroll sideways at the required widths", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/");
  await page.getByLabel("Your name").fill("Responsive Test");
  await page.getByLabel("Workspace name").fill("Width Brew");
  await page.getByRole("switch", { name: "Import the included 2026 tracker" }).click();
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/add");
  await page.getByRole("button", { name: /^Add Tea Medium,/ }).click();
  await page.getByRole("button", { name: /^Add Black Coffee,/ }).click();

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });

    for (const path of ["/", "/add", "/reports", "/expenses", "/data"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      const { overflow, offenders } = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        const offenderList = [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.right > viewport + 1 || rect.left < -1);
          })
          .slice(0, 12)
          .map((element) => ({
            tag: element.tagName,
            className: typeof element.className === "string" ? element.className : "",
            text: element.textContent?.trim().slice(0, 80) ?? "",
            left: Math.round(element.getBoundingClientRect().left),
            right: Math.round(element.getBoundingClientRect().right),
          }));
        return {
          overflow: document.documentElement.scrollWidth - viewport,
          offenders: offenderList,
        };
      });
      if (overflow > 1) console.log({ width, path, overflow, offenders });
      expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});
