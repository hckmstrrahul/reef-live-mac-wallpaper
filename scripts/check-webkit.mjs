import { webkit } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
const browser = await webkit.launch({ headless: true });
const appBundle = process.argv.includes("--app");
const offline = appBundle || process.argv.includes("--file");
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      colorScheme: "light",
    }),
    errors = [];
  page.on(
    "pageerror",
    (e) => (errors.push(e.message), console.error(e.message)),
  );
  page.on("console", (m) => {
    console.log(m.type(), m.text());
    if (
      m.type() === "error" ||
      (m.type() === "warning" && /UniformsUtils|WebGL|Shader/.test(m.text()))
    ) {
      errors.push(m.text());
      console.error(m.text());
    }
  });
  await page.goto(
    offline
      ? pathToFileURL(
          path.resolve(
            appBundle
              ? "build/Reef.app/Contents/Resources/index.html"
              : "dist/index.html",
          ),
        ).href
      : "http://127.0.0.1:4187",
    { waitUntil: "domcontentloaded", timeout: 45000 },
  );
  await page.waitForFunction(() => window.aquarium?.stats().time > 1, null, {
    timeout: 60000,
  });
  const target = await page.evaluate(() => window.aquarium.targets()[0]);
  await page.mouse.click(target.x * 1280, target.y * 800);
  await page.waitForFunction(() => window.aquarium.stats().maxShy > 0.1);
  await page.evaluate(() => window.aquarium.setPaused(true));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(
    () => window.aquarium.stats().appearance.resolved === "Night",
  );
  await page.evaluate(() => window.aquarium.setAppearance("Day"));
  assert.equal(
    await page.evaluate(() => window.aquarium.stats().appearance.resolved),
    "Day",
  );
  await page.evaluate(() => window.aquarium.setAppearance("Night"));
  await page.emulateMedia({ colorScheme: "light" });
  assert.equal(
    await page.evaluate(() => window.aquarium.stats().appearance.resolved),
    "Night",
  );
  await page.waitForTimeout(250);
  await page.screenshot({ path: "build/night-webkit.png" });
  await page.evaluate(() => window.aquarium.setAppearance("Planet X", true));
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(() => aquarium.stats().appearance.resolved),
    "Planet X",
  );
  assert.equal(
    await page.evaluate(() => aquarium.stats().nightEffects.palette),
    "Planet X",
  );
  await page.screenshot({ path: "build/planet-x-webkit.png" });
  await page.emulateMedia({ colorScheme: "dark" });
  assert.equal(
    await page.evaluate(() => aquarium.stats().appearance.resolved),
    "Planet X",
  );
  await page.emulateMedia({ colorScheme: "light" });
  // WebKit delivers matchMedia changes on its next rendering update.
  await page.waitForFunction(() => !aquarium.stats().appearance.systemDark);
  for (const [hour, expected] of [
    [8, "Day"],
    [18, "Planet X"],
    [23, "Night"],
  ]) {
    const localTime = await page.evaluate(
      (hour) => new Date(2026, 9, 4, hour).toISOString(),
      hour,
    );
    await page.clock.setFixedTime(localTime);
    if (hour === 8)
      await page.evaluate(() => aquarium.setAppearance("Daily", true));
    else await page.evaluate(() => aquarium.hostPause(false));
    assert.equal(
      await page.evaluate(() => aquarium.stats().appearance.resolved),
      expected,
    );
    assert.equal(
      await page.evaluate(() => aquarium.stats().appearance.mode),
      "Daily",
    );
  }
  await page.evaluate(() => window.aquarium.setAppearance("System"));
  assert.equal(
    await page.evaluate(() => window.aquarium.stats().appearance.resolved),
    "Day",
  );
  assert.equal(
    await page.evaluate(() => aquarium.stats().daylightClarity.exposure),
    1.06 * 1.2,
  );
  const before = await page.evaluate(() => window.aquarium.stats());
  const fish = await page.evaluate(() => window.aquarium.targets()[0]);
  await page.mouse.move(fish.x * 1280, fish.y * 800);
  await page.mouse.down();
  await page.mouse.move(fish.x * 1280 + 150, fish.y * 800 - 110, { steps: 8 });
  await page.mouse.up();
  const dragged = await page.evaluate(() => window.aquarium.stats());
  assert.equal(dragged.lastInteraction, "fish-drag");
  assert.ok(
    dragged.fishStates[0].position[0] > before.fishStates[0].position[0] + 0.5,
  );
  assert.deepEqual(dragged.navigation.target, before.navigation.target);
  assert.equal(dragged.collisions.overlaps, 0);
  await page.evaluate(() => {
    window.aquarium.pointer("down", 0.5, 0.1);
    window.aquarium.pointer("move", 0.65, 0.15);
    window.aquarium.pointer("up", 0.65, 0.15);
    window.aquarium.zoom(0.7);
  });
  const moved = await page.evaluate(() => window.aquarium.stats());
  assert.ok(Math.abs(moved.navigation.target[0]) > 1);
  assert.ok(moved.navigation.distance < before.navigation.distance - 3);
  await page.evaluate(() => window.aquarium.reset());
  console.log(
    JSON.stringify(
      {
        engine: "WebKit",
        offlineFileLoad: offline,
        appBundle,
        stats: await page.evaluate(() => window.aquarium.stats()),
        errors,
      },
      null,
      2,
    ),
  );
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
