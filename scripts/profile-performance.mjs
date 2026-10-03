import { chromium, webkit } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const engine = process.argv.includes("--webkit") ? "WebKit" : "Chrome";
const browser =
  engine === "WebKit"
    ? await webkit.launch({ headless: true })
    : await chromium.launch({ channel: "chrome", headless: true });
const results = [];
const warmupMs = process.argv.includes("--steady") ? 15000 : 6000;
try {
  for (const [width, height, scale] of [
    [1600, 1000, 1],
    [2560, 1440, 2],
  ]) {
    if (process.argv.includes("--retina") && scale !== 2) continue;
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: scale,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("http://127.0.0.1:4187");
    await page.waitForFunction(() => window.aquarium?.stats().time > 2, null, {
      timeout: 90000,
    });
    const appearance = process.argv.includes("--planet-x")
      ? "Planet X"
      : process.argv.includes("--night")
        ? "Night"
        : "Day";
    await page.evaluate(
      (mode) => window.aquarium.setAppearance(mode),
      appearance,
    );
    for (const quality of ["High", "Balanced"]) {
      await page.evaluate((q) => window.aquarium.setQuality(q), quality);
      await page.waitForTimeout(warmupMs);
      const result = await page.evaluate(async () => {
        const a = window.aquarium,
          initial = a.stats(),
          start = performance.now(),
          times = [],
          changed = [],
          beforeFish = initial.fishStates[0].routeDistance;
        let previous = start,
          previousTime = initial.time,
          lastChange = start;
        await new Promise((resolve) => {
          function tick(now) {
            times.push(now - previous);
            previous = now;
            const current = a.stats().time;
            if (current !== previousTime) {
              changed.push(now - lastChange);
              lastChange = now;
              previousTime = current;
            }
            if (now - start < 6500) requestAnimationFrame(tick);
            else resolve();
          }
          requestAnimationFrame(tick);
        });
        const end = performance.now(),
          final = a.stats(),
          sorted = changed.slice().sort((a, b) => a - b);
        return {
          wallSeconds: (end - start) / 1000,
          simulationSeconds: final.time - initial.time,
          fishTravel: final.fishStates[0].routeDistance - beforeFish,
          renderedFps: changed.length / ((end - start) / 1000),
          medianFrameMs: sorted[Math.floor(sorted.length * 0.5)],
          p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
          frameOver34Ms: changed.filter((v) => v > 34).length,
          drawCalls: final.drawCalls,
          triangles: final.triangles,
          performance: final.performance,
        };
      });
      const row = {
        engine,
        width,
        height,
        deviceScaleFactor: scale,
        quality,
        appearance,
        warmupSeconds: warmupMs / 1000,
        ...result,
        errors,
      };
      results.push(row);
      console.log(JSON.stringify(row));
    }
    await page.close();
  }
  await writeFile(
    process.argv[2] ?? "build/performance.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
