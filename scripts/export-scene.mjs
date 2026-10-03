import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  page.on("pageerror", console.error);
  await page.goto("http://127.0.0.1:4187");
  await page.waitForFunction(() => window.aquarium?.stats().time > 1.2, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    window.aquarium.setPaused(true);
    window.aquarium.setAppearance("Day");
  });
  await mkdir("assets/blender", { recursive: true });
  const downloadReady = page.waitForEvent("download", { timeout: 180000 });
  downloadReady.catch(() => {}); // Preserve an earlier export error if the page closes.
  await page.evaluate(async () => {
    const glb = await window.aquarium.exportGLB();
    // Keep the export binary: a base64 data URL can exceed the JS string limit.
    const url = URL.createObjectURL(
      new Blob([glb], { type: "model/gltf-binary" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "reef.glb";
    document.body.append(link);
    link.click();
    link.remove();
  });
  const download = await downloadReady;
  await download.saveAs("assets/blender/reef.glb");
  console.log("Exported editable 3D scene to assets/blender/reef.glb");
} finally {
  await browser.close();
}
