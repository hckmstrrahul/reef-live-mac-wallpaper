import { chromium } from "@playwright/test";
import { writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:4187/?inspect");
  await page.waitForFunction(() => window.aquarium?.stats().time > 1, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    aquarium.setPaused(true);
    aquarium.setAppearance("Planet X");
    document.body.classList.add("quiet");
  });
  await page.waitForTimeout(700);
  const fish = await page.evaluate(() => aquarium.stats().fishStates);
  const counts = {};
  fish.forEach(
    (f) => (counts[f.planetPattern] = (counts[f.planetPattern] || 0) + 1),
  );
  assert.equal(Object.keys(counts).length, 8);
  assert.equal(counts["Halo rings"] + counts["Flowing channels"], 7);
  const cards = [];
  for (const index of [0, 5, 12, 3, 2, 15, 1, 8]) {
    const name = fish[index].planetPattern;
    const path = `build/planet-fish-${name.toLowerCase().replaceAll(" ", "-")}.png`;
    await page.evaluate((index) => {
      const d = reefInspect,
        p = aquarium.stats().fishStates[index].position;
      let selected;
      d.scene.traverse((o) => {
        if (
          o.userData.fishIndex !== undefined &&
          o.isMesh &&
          o.name.includes(" — ")
        ) {
          o.parent.visible = o.userData.fishIndex === index;
          if (o.userData.fishIndex === index) selected = o.parent;
        }
      });
      selected.rotation.set(0, 0, 0);
      d.camera.position.set(p[0], p[1] + 0.02, p[2] + selected.scale.x * 4.0);
      d.camera.lookAt(...p);
      d.camera.updateMatrixWorld();
      d.uniforms.time.value = 3;
      d.composer.render();
    }, index);
    await page.screenshot({ path });
    cards.push({ name, image: (await readFile(path)).toString("base64") });
  }
  // Contact sheet of actual renderer screenshots for comparing scale and detail.
  await page.setViewportSize({ width: 1600, height: 1110 });
  await page.setContent(
    `<link rel="icon" href="data:,"><style>body{margin:0;background:#100912;color:#f8dae2;font:16px system-ui}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2px}img{width:100%;display:block}.label{padding:12px 14px 18px}h1{font:24px system-ui;padding:20px 18px 10px}p{color:#bd939f;padding:0 18px 15px}</style><h1>Planet X · Eight living pigments</h1><p>37 fish with new markings · 7 retain rings or flowing channels</p><div class="grid">${cards.map((c) => `<div><img src="data:image/png;base64,${c.image}"><div class="label">${c.name}</div></div>`).join("")}</div>`,
  );
  await page.locator("img").last().waitFor();
  await page.evaluate(
    async () => await Promise.all([...document.images].map((i) => i.decode())),
  );
  await page.screenshot({
    path: "build/planet-x-patterns.png",
    clip: { x: 0, y: 0, width: 1600, height: 750 },
  });
  assert.deepEqual(errors, []);
  await writeFile(
    "build/planet-fish-inspection.json",
    JSON.stringify({ counts, errors }, null, 2),
  );
  console.log(JSON.stringify({ counts, errors }));
} finally {
  await browser.close();
}
