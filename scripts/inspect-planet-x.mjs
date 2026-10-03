import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

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
  await page.goto("http://127.0.0.1:4187/?inspect");
  await page.waitForFunction(() => window.aquarium?.stats().time > 2, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    aquarium.setPaused(true);
    document.body.classList.add("quiet");
  });
  await page.waitForTimeout(750);
  const appearances = {};
  for (const mode of ["Day", "Night", "Planet X"]) {
    await page.evaluate((mode) => aquarium.setAppearance(mode), mode);
    await page.waitForTimeout(350);
    const key = mode.toLowerCase().replaceAll(" ", "-");
    await page.screenshot({ path: `build/${key}-preview.png` });
    appearances[mode] = await page.evaluate(() => aquarium.stats());
  }
  // Keep pose and camera fixed while advancing only the optical clock.
  for (const time of [0, 4]) {
    await page.evaluate((time) => {
      const d = reefInspect,
        p = aquarium.stats().fishStates[1].position;
      d.camera.position.set(p[0], p[1] + 0.025, p[2] + 2.65);
      d.camera.lookAt(...p);
      d.camera.updateMatrixWorld();
      d.uniforms.time.value = time;
      d.composer.render();
    }, time);
    await page.screenshot({ path: `build/planet-x-fish-${time}.png` });
  }
  await page.evaluate(() => {
    const d = reefInspect;
    d.camera.position.set(-5, 2.9, 8.5);
    d.camera.lookAt(-4.9, 1.8, 0);
    d.camera.updateMatrixWorld();
    d.composer.render();
  });
  await page.screenshot({ path: "build/planet-x-reef.png" });
  assert.deepEqual(errors, []);
  assert.equal(appearances["Planet X"].appearance.resolved, "Planet X");
  await writeFile(
    "build/planet-x-inspection.json",
    JSON.stringify({ appearances, errors }, null, 2),
  );
  console.log(
    JSON.stringify({ appearances: Object.keys(appearances), errors }),
  );
} finally {
  await browser.close();
}
