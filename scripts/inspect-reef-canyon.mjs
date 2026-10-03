import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
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
  await page.waitForFunction(() => window.aquarium?.stats().time > 3, null, {
    timeout: 90000,
  });
  await page.evaluate(() => {
    window.aquarium.setAppearance("Day");
    document.body.classList.add("quiet");
  });
  await page.waitForTimeout(700);
  const download = page.waitForEvent("download", { timeout: 90000 });
  const audit = await page.evaluate(async () => {
    const a = window.aquarium,
      initial = a.stats();
    const distance = initial.fishStates.map(() => 0),
      stopped = distance.slice(),
      maxStopped = distance.slice();
    let previous = initial,
      maxOverlaps = 0;
    const sources = new Set(),
      nearVisitors = new Set(),
      distantFish = new Set();
    const bubbleSizes = { tiny: 0, medium: 0, large: 0 };
    const clarity = initial.daylightClarity;
    const support = initial.shelfContact;
    const stream = document.querySelector("canvas").captureStream(30);
    const chunks = [],
      recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 7500000,
      });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.start();
    for (let i = 0; i < 400; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (i === 20 || i === 150) {
        const p = a.targets()[0];
        a.click(p.x, p.y);
      }
      if (i === 90) a.setAppearance("Night");
      const current = a.stats();
      maxOverlaps = Math.max(maxOverlaps, current.collisions.overlaps);
      current.bubbleOptics.sources.forEach((v) => sources.add(v.site));
      for (const size of Object.keys(bubbleSizes))
        bubbleSizes[size] = Math.max(
          bubbleSizes[size],
          current.bubbleOptics.sizes[size],
        );
      current.fishStates.forEach((f, j) => {
        const d = Math.hypot(
          ...f.position.map((v, k) => v - previous.fishStates[j].position[k]),
        );
        distance[j] += d;
        if (f.position[2] > 4.5 && Math.abs(f.position[0]) < 5.5)
          nearVisitors.add(j);
        if (f.position[2] < -2.5) distantFish.add(j);
        stopped[j] = d < 0.001 ? stopped[j] + 0.1 : 0;
        maxStopped[j] = Math.max(maxStopped[j], stopped[j]);
      });
      previous = current;
      if (i === 219) {
        recorder.stop();
        await done;
        stream.getTracks().forEach((t) => t.stop());
      }
    }
    const blob = new Blob(chunks, { type: "video/webm" }),
      link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "reef-canyon.webm";
    link.click();
    const final = a.stats();
    return {
      seconds: final.time - initial.time,
      maxOverlaps,
      collisions: final.collisions,
      sourcesVisited: [...sources],
      nearVisitors: [...nearVisitors],
      distantFish: [...distantFish],
      bubbleSizes,
      clarity,
      support,
      swimmers: final.fishStates.map((f, i) => ({
        name: f.name,
        metres: distance[i],
        maxStoppedSeconds: maxStopped[i],
      })),
    };
  });
  await (await download).saveAs("build/reef-canyon.webm");
  await writeFile(
    "build/reef-canyon-inspection.json",
    JSON.stringify({ audit, errors }, null, 2),
  );
  assert.equal(audit.maxOverlaps, 0);
  assert.ok(
    audit.swimmers.every((f) => f.metres > 3),
    "Every swimmer makes forward progress",
  );
  assert.deepEqual(errors, []);
  assert.ok(audit.sourcesVisited.length >= 8);
  assert.ok(audit.nearVisitors.length >= 8);
  assert.ok(audit.distantFish.length >= 4);
  assert.ok(Object.values(audit.bubbleSizes).every((n) => n > 0));
  assert.equal(audit.clarity.distantBlur, false);
  assert.ok(audit.clarity.fogDensity <= 0.008);
  assert.ok(audit.support.contacts > 0 && audit.support.gapAfter < 0);
  console.log(
    JSON.stringify({
      seconds: audit.seconds,
      overlaps: audit.maxOverlaps,
      minTravel: Math.min(...audit.swimmers.map((f) => f.metres)),
      maxStopped: Math.max(...audit.swimmers.map((f) => f.maxStoppedSeconds)),
      nearVisitors: audit.nearVisitors.length,
      sourceSites: audit.sourcesVisited.length,
      bubbleSizes: audit.bubbleSizes,
      errors,
    }),
  );
} finally {
  await browser.close();
}
