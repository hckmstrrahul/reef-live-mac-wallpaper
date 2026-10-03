import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => console.error(e));
page.on("console", (m) => {
  if (m.type() === "error") console.error(m.text());
});
await page.goto("http://127.0.0.1:4187");
await page.waitForFunction(() => window.aquarium?.stats().time > 2, {
  timeout: 60000,
});
await page.evaluate(() => {
  window.aquarium.setPaused(true);
  document.body.classList.add("quiet");
});
await page.waitForTimeout(650);
await page.screenshot({ path: "build/preview.png" });
console.log(await page.evaluate(() => window.aquarium.stats()));
await browser.close();
