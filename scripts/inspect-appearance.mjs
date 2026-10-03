import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    colorScheme: "light",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:4187");
  await page.waitForFunction(() => window.aquarium?.stats().time > 3, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    window.aquarium.setPaused(true);
    document.body.classList.add("quiet");
  });
  await page.waitForTimeout(650);
  for (const mode of ["Day", "Night"]) {
    await page.evaluate((mode) => window.aquarium.setAppearance(mode), mode);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `build/${mode.toLowerCase()}-preview.png` });
  }
  await page.evaluate(() => {
    window.aquarium.setAppearance("Day");
    window.aquarium.zoom(0.64);
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: "build/coral-detail.png" });
  await page.evaluate(() => {
    window.aquarium.reset();
    window.aquarium.setAppearance("Day");
  });
  await page.setViewportSize({ width: 2048, height: 960 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "build/wide-day-preview.png" });
  const stats = await page.evaluate(() => window.aquarium.stats());
  await writeFile(
    "build/appearance-inspection.json",
    JSON.stringify({ stats, errors }, null, 2),
  );
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    JSON.stringify({
      drawCalls: stats.drawCalls,
      triangles: stats.triangles,
      errors,
    }),
  );
} finally {
  await browser.close();
}
