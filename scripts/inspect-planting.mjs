import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  const errors = [],
    start = Date.now();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4187/?inspect");
  await page.waitForFunction(() => window.aquarium?.stats().time > 2, null, {
    timeout: 90000,
  });
  const readyMs = Date.now() - start;
  await page.evaluate(() => {
    aquarium.setPaused(true);
    document.body.classList.add("quiet");
  });
  await page.waitForTimeout(1000);
  const stats = await page.evaluate(() => aquarium.stats());
  assert.equal(Object.keys(stats.planting.varieties).length, 6);
  assert.ok(stats.planting.shoots > 800);
  assert.ok(
    stats.planting.varieties.ribbon + stats.planting.varieties.feather >
      stats.planting.shoots * 0.7,
  );
  assert.ok(stats.planting.preventedIntersections > 0);
  for (const mode of ["Day", "Night"]) {
    await page.evaluate((mode) => {
      aquarium.setAppearance(mode);
      const d = reefInspect;
      d.camera.position.set(-6.2, 2.35, 8.5);
      d.camera.lookAt(-5.7, 1.65, 3.8);
      d.camera.updateMatrixWorld();
      d.composer.render();
    }, mode);
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `build/plants-${mode.toLowerCase()}-detail.png`,
    });
  }
  // Freeze geometry and advance only the shared optical clock: this makes the
  // material color shift reviewable independently of fish translation/tail pose.
  for (const t of [0, 6]) {
    await page.evaluate((t) => {
      aquarium.setAppearance("Night");
      const d = reefInspect,
        p = aquarium.stats().fishStates[8].position;
      d.camera.position.set(p[0], p[1] + 0.05, p[2] + 2.6);
      d.camera.lookAt(...p);
      d.camera.updateMatrixWorld();
      d.uniforms.time.value = t;
      d.composer.render();
    }, t);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `build/uv-fish-${t}.png` });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    "build/planting-inspection.json",
    JSON.stringify({ readyMs, planting: stats.planting, errors }, null, 2),
  );
  console.log(JSON.stringify({ readyMs, planting: stats.planting, errors }));
} finally {
  await browser.close();
}
