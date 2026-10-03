import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:4187");
  await page.waitForFunction(() => window.aquarium?.stats().time > 2, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    window.aquarium.setPaused(true);
    document.body.classList.add("quiet");
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const a = window.aquarium,
      p = a.targets()[3];
    a.pointer("down", p.x, p.y);
    a.pointer("move", 0.5, 0.44);
    a.pointer("up", 0.5, 0.44);
    a.zoom(0.5);
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "build/fish-materials.png" });
  await page.evaluate(() => {
    const a = window.aquarium;
    a.reset();
    a.pointer("down", 0.5, 0.1);
    a.pointer("move", 0.18, 0.1);
    a.pointer("up", 0.18, 0.1);
    a.zoom(0.7);
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "build/reef-materials.png" });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Fish and reef material previews saved; no renderer errors.");
} finally {
  await browser.close();
}
