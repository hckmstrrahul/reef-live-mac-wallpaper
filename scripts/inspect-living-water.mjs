import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
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
  await page.goto("http://127.0.0.1:4187");
  await page.waitForFunction(() => window.aquarium?.stats().time > 3, null, {
    timeout: 90000,
  });
  await page.evaluate(() => document.body.classList.add("quiet"));
  await page.waitForTimeout(600);
  await page.screenshot({ path: "build/preview.png" });
  const before = await page.evaluate(() => window.aquarium.stats());
  const download = page.waitForEvent("download");
  await page.evaluate(async () => {
    const stream = document.querySelector("canvas").captureStream(30);
    const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 6500000,
      }),
      chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 12000));
    recorder.stop();
    await done;
    stream.getTracks().forEach((t) => t.stop());
    const url = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "living-water.webm";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  });
  await (await download).saveAs("build/living-water.webm");
  const after = await page.evaluate(() => window.aquarium.stats());
  await page.screenshot({ path: "build/swimming-after.png" });
  await page.evaluate(() => {
    const a = window.aquarium;
    a.setPaused(true);
    const p = a.targets()[0];
    a.pointer("down", p.x, p.y);
    a.pointer("move", 0.5, 0.45);
    a.pointer("up", 0.5, 0.45);
    a.zoom(0.55);
    a.setPaused(false);
  });
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(180);
    await page.screenshot({
      path: `build/swim-detail-${i}.png`,
      clip: { x: 440, y: 260, width: 700, height: 480 },
    });
  }
  await writeFile(
    "build/living-water-inspection.json",
    JSON.stringify(
      {
        errors,
        fish: after.fish,
        reflection: after.waterReflection,
        movement: after.fishStates.map((f, i) => ({
          name: f.name,
          from: before.fishStates[i].position,
          to: f.position,
          startStroke: before.fishStates[i].stroke,
          endStroke: f.stroke,
          startFins: before.fishStates[i].fins,
          endFins: f.fins,
        })),
      },
      null,
      2,
    ),
  );
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Captured live video, swimming/fin details and reflection diagnostics with no renderer errors.",
  );
} finally {
  await browser.close();
}
