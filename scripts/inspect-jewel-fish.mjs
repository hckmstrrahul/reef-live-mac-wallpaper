import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    }),
    errors = [];
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
  await page.waitForTimeout(900);
  for (const mode of ["Day", "Night"]) {
    for (const time of mode === "Day" ? [0] : [0, 6]) {
      await page.evaluate(
        ({ mode, time }) => {
          aquarium.setAppearance(mode);
          const d = reefInspect,
            p = aquarium.stats().fishStates[1].position;
          d.camera.position.set(p[0], p[1] + 0.025, p[2] + 2.65);
          d.camera.lookAt(...p);
          d.camera.updateMatrixWorld();
          d.uniforms.time.value = time;
          d.composer.render();
        },
        { mode, time },
      );
      await page.waitForTimeout(250);
      await page.screenshot({
        path: `build/jewel-fish-${mode.toLowerCase()}-${time}.png`,
      });
    }
  }
  const state = await page.evaluate(() => aquarium.stats());
  assert.equal(state.fishStates[1].name, "Jewel-spotted angelfish");
  assert.deepEqual(errors, []);
  await writeFile(
    "build/jewel-fish-inspection.json",
    JSON.stringify({ fish: state.fishStates[1], errors }, null, 2),
  );
  console.log(JSON.stringify({ fish: state.fishStates[1].name, errors }));
} finally {
  await browser.close();
}
