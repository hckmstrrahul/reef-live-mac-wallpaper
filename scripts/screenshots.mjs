import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, colorScheme: "light" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("http://127.0.0.1:4187");
  await page.waitForFunction(() => window.aquarium?.stats().time > 3, null, { timeout: 60000 });
  await page.evaluate(() => { aquarium.setPaused(true); aquarium.wallpaper(true); });
  await mkdir("docs/images", { recursive: true });
  for (const [mode, name] of [["Day", "daylight"], ["Night", "uv-night"], ["Planet X", "planet-x"]]) {
    await page.evaluate((mode) => aquarium.setAppearance(mode), mode);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `docs/images/${name}.jpg`, type: "jpeg", quality: 88 });
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Captured all three themes with no renderer errors.");
} finally { await browser.close(); }
