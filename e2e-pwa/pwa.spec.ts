import { expect, test } from "@playwright/test";

test("the production PWA is installable and opens offline from its shell cache", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page).toHaveURL(/\/welcome$/);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();

  const manifest = await page.evaluate(async (href) => {
    const response = await fetch(href as string);
    if (!response.ok) throw new Error(`Manifest request failed: ${response.status}`);
    return response.json() as Promise<{
      name: string;
      short_name: string;
      display: string;
      start_url: string;
      theme_color: string;
      background_color: string;
      orientation: string;
      icons: { src: string; sizes: string; purpose?: string }[];
    }>;
  }, manifestHref);

  expect(manifest.name).toBe("DailyBrew");
  expect(manifest.short_name).toBe("DailyBrew");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.theme_color.toUpperCase()).toBe("#38251D");
  expect(manifest.background_color.toUpperCase()).toBe("#FAF6EF");
  expect(manifest.orientation).toBe("portrait");
  expect(manifest.icons.some((icon) => icon.sizes === "192x192")).toBe(true);
  expect(manifest.icons.some((icon) => icon.sizes === "512x512")).toBe(true);
  expect(manifest.icons.some((icon) => icon.purpose?.includes("maskable"))).toBe(true);

  for (const icon of manifest.icons) {
    const response = await page.request.get(new URL(icon.src, page.url()).toString());
    expect(response.status(), `Missing icon ${icon.src}`).toBe(200);
  }

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state ?? "missing";
        }),
      { timeout: 15_000 },
    )
    .toBe("activated");

  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toContain("4174");

  // Reload online once so the active worker controls this client, then prove
  // the application shell still opens with the network disabled.
  await page.reload();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open my workspace" })).toBeVisible();
});
