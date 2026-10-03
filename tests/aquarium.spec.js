import { test, expect } from "@playwright/test";
test("renders, reacts to fish and reef clicks, pauses, and changes quality", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /WebGL|Shader|THREE/.test(m.text()))
      errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:4187");
  await page.waitForFunction(() => window.aquarium?.stats().time > 1.5, null, {
    timeout: 60000,
  });
  await expect(page.locator("#error")).toBeHidden();
  expect(await page.evaluate(() => window.aquarium.stats().fish)).toBe(44);
  const fish = await page.evaluate(() => window.aquarium.targets()[0]);
  await page.mouse.click(fish.x * 1440, fish.y * 900);
  expect(
    await page.evaluate(() => window.aquarium.stats().lastInteraction),
  ).toBe("fish");
  await page.waitForFunction(() => window.aquarium.stats().maxShy > 0.1);
  // Sand is part of the actual 3D reef and has a stable exposed point at this framing.
  await page.mouse.click(720, 730);
  expect(
    await page.evaluate(() => window.aquarium.stats().lastInteraction),
  ).toBe("reef");
  await page.getByRole("button", { name: "Pause aquarium" }).click();
  const t = await page.evaluate(() => window.aquarium.stats().time);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.aquarium.stats().time)).toBe(t);
  await page.getByRole("button", { name: "Quality: High" }).click();
  expect(await page.evaluate(() => window.aquarium.stats().quality)).toBe(
    "Balanced",
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.aquarium.stats().time)).toBe(t);
  await page.getByRole("button", { name: "Resume aquarium" }).click();
  await page.waitForFunction((t) => window.aquarium.stats().time > t + 0.15, t);
  await page.keyboard.press("h");
  await expect(page.locator("body")).toHaveClass(/quiet/);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "build/verified-preview.png" });
});

test("fish can be repositioned independently; pan, wheel, pinch and native gesture bridge work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:4187");
  await page.waitForFunction(() => window.aquarium?.stats().time > 1);
  await page.evaluate(() => window.aquarium.setPaused(true));
  const target = await page.evaluate(() => window.aquarium.targets()[0]);
  const before = await page.evaluate(() => window.aquarium.stats());
  await page.mouse.move(target.x * 1440, target.y * 900);
  await page.mouse.down();
  await page.mouse.move(target.x * 1440 + 170, target.y * 900 - 125, {
    steps: 12,
  });
  await page.mouse.up();
  const dragged = await page.evaluate(() => window.aquarium.stats());
  expect(dragged.lastInteraction).toBe("fish-drag");
  expect(dragged.fishStates[0].position[0]).toBeGreaterThan(
    before.fishStates[0].position[0] + 0.8,
  );
  expect(dragged.navigation.target).toEqual(before.navigation.target);
  // Pan empty water, not a fish or a control.
  await page.mouse.move(680, 100);
  await page.mouse.down();
  await page.mouse.move(990, 180, { steps: 12 });
  await page.mouse.up();
  const panned = await page.evaluate(() => window.aquarium.stats());
  expect(Math.abs(panned.navigation.target[0])).toBeGreaterThan(2);
  await page.mouse.wheel(0, -350);
  const zoomed = await page.evaluate(
    () => window.aquarium.stats().navigation.distance,
  );
  expect(zoomed).toBeLessThan(before.navigation.distance - 3);
  await page.evaluate(() => window.aquarium.reset());
  // Safari gesturechange uses the same pinch scale delivered by the native trackpad.
  await page
    .locator("canvas")
    .first()
    .evaluate((canvas) => {
      for (const [type, scale] of [
        ["gesturestart", 1],
        ["gesturechange", 1.5],
        ["gestureend", 1.5],
      ]) {
        const e = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(e, "scale", { value: scale });
        canvas.dispatchEvent(e);
      }
    });
  expect(
    await page.evaluate(() => window.aquarium.stats().navigation.distance),
  ).toBeCloseTo(before.navigation.distance / 1.5, 5);
  await page.evaluate(() => {
    window.aquarium.reset();
    window.aquarium.pointer("down", 0.5, 0.1);
    window.aquarium.pointer("move", 0.65, 0.15);
    window.aquarium.pointer("up", 0.65, 0.15);
  });
  expect(
    Math.abs(
      await page.evaluate(() => window.aquarium.stats().navigation.target[0]),
    ),
  ).toBeGreaterThan(1);
  await page.evaluate(() => window.aquarium.reset());
  // The optical path remains usable at close range, with no shader errors.
  await page.evaluate(() => window.aquarium.zoom(0.52));
  await page.waitForTimeout(400);
  await page.screenshot({ path: "build/close-up.png" });
  expect(errors).toEqual([]);
});

test("holding a click keeps a fish swimming; its brief reflex does not interrupt the route", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4187");
  await page.waitForFunction(() => window.aquarium?.stats().time > 1.5);
  const target = await page.evaluate(() => window.aquarium.targets()[0]);
  await page.mouse.move(target.x * 1440, target.y * 900);
  await page.mouse.down();
  const before = await page.evaluate(() => window.aquarium.stats());
  await page.waitForTimeout(240);
  const held = await page.evaluate(() => window.aquarium.stats());
  expect(held.navigation.draggingFish).toBeNull();
  expect(held.fishStates[0].position).not.toEqual(
    before.fishStates[0].position,
  );
  await page.mouse.up();
  expect(
    await page.evaluate(() => window.aquarium.stats().lastInteraction),
  ).toBe("fish");
  await page.waitForFunction(() => window.aquarium.stats().maxShy > 0.05);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.aquarium.stats().maxShy)).toBe(0);
});

test("appearance follows system changes, manual overrides persist, and paused views repaint", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("http://127.0.0.1:4187");
  await page.waitForFunction(() => window.aquarium?.stats().time > 1.5);
  const appearance = () =>
    page.evaluate(() => window.aquarium.stats().appearance);
  expect(await appearance()).toEqual({
    mode: "System",
    resolved: "Day",
    systemDark: false,
  });
  await page.evaluate(() => window.aquarium.setPaused(true));
  const time = await page.evaluate(() => window.aquarium.stats().time);
  await page.getByLabel("Aquarium appearance").focus();
  await page.keyboard.press("h");
  await expect(page.locator("body")).not.toHaveClass(/quiet/);
  await page.getByLabel("Aquarium appearance").evaluate((el) => el.blur());
  const day = await page
    .locator("canvas")
    .first()
    .screenshot({ path: "build/test-system-day.png" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(async () => (await appearance()).resolved).toBe("Night");
  await page.waitForTimeout(300);
  const night = await page
    .locator("canvas")
    .first()
    .screenshot({ path: "build/test-system-night.png" });
  expect(night.equals(day)).toBe(false);
  expect(await page.evaluate(() => window.aquarium.stats().time)).toBe(time);
  await page.getByLabel("Aquarium appearance").selectOption("Day");
  expect((await appearance()).resolved).toBe("Day");
  await page.evaluate(() => window.aquarium.setQuality("Eco"));
  await page.waitForTimeout(100);
  const reflections = await page.evaluate(
    () => window.aquarium.stats().waterReflection.captures,
  );
  await page.getByLabel("Aquarium appearance").selectOption("Night");
  await expect
    .poll(() =>
      page.evaluate(() => window.aquarium.stats().waterReflection.captures),
    )
    .toBeGreaterThan(reflections);
  await page.getByLabel("Aquarium appearance").selectOption("Day");
  await page.reload();
  await page.waitForFunction(() => window.aquarium?.stats().time > 1);
  expect((await appearance()).mode).toBe("Day");
  expect((await appearance()).resolved).toBe("Day");
  await page.getByLabel("Aquarium appearance").selectOption("Night");
  await page.emulateMedia({ colorScheme: "light" });
  expect((await appearance()).resolved).toBe("Night");
  // A second view gets the saved mode, then tracks preference changes.
  const other = await context.newPage();
  await other.goto("http://127.0.0.1:4187");
  await other.waitForFunction(() => window.aquarium?.stats().time > 1);
  expect(
    await other.evaluate(() => window.aquarium.stats().appearance.mode),
  ).toBe("Night");
  await page.getByLabel("Aquarium appearance").selectOption("System");
  await expect
    .poll(() => other.evaluate(() => window.aquarium.stats().appearance.mode))
    .toBe("System");
  await other.close();
  expect((await appearance()).resolved).toBe("Day");
  expect(errors).toEqual([]);
});

test("Planet X renders while paused, persists across views and restores ordinary lighting", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("http://127.0.0.1:4187");
  await page.waitForFunction(() => window.aquarium?.stats().time > 1);
  await page.evaluate(() => aquarium.setPaused(true));
  const original = await page.evaluate(() => aquarium.stats());
  await page.getByLabel("Aquarium appearance").selectOption("Night");
  const night = await page.locator("canvas").first().screenshot();
  await page.getByLabel("Aquarium appearance").selectOption("Planet X");
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance",
    "planet-x",
  );
  const planet = await page
    .locator("canvas")
    .first()
    .screenshot({ path: "build/test-planet-x.png" });
  expect(planet.equals(night)).toBe(false);
  const state = await page.evaluate(() => aquarium.stats());
  expect(state.time).toBe(original.time);
  expect(state.nightEffects.palette).toBe("Planet X");
  expect(state.nightEffects.selectiveGlow).toBe(true);
  expect(state.waterReflection.captures).toBeGreaterThan(
    original.waterReflection.captures,
  );
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await page.evaluate(() => aquarium.stats().appearance.resolved)).toBe(
    "Planet X",
  );
  await page.reload();
  await page.waitForFunction(() => window.aquarium?.stats().time > 1);
  await expect(page.getByLabel("Aquarium appearance")).toHaveValue("Planet X");
  const other = await context.newPage();
  await other.goto("http://127.0.0.1:4187");
  await other.waitForFunction(() => window.aquarium?.stats().time > 1);
  expect(await other.evaluate(() => aquarium.stats().appearance.resolved)).toBe(
    "Planet X",
  );
  // Host-delivered selections must use the same mode path as the native menu.
  await page.evaluate(() => aquarium.setAppearance("Day", true));
  await expect
    .poll(() => other.evaluate(() => aquarium.stats().appearance.resolved))
    .toBe("Day");
  const day = await page.evaluate(() => aquarium.stats());
  expect(day.daylightClarity.exposure).toBeCloseTo(1.06 * 1.2, 5);
  expect(day.nightEffects.enabled).toBe(false);
  expect(day.nightEffects.selectiveGlow).toBe(false);
  await page.getByLabel("Aquarium appearance").selectOption("System");
  expect(await page.evaluate(() => aquarium.stats().appearance.resolved)).toBe(
    "Night",
  );
  await other.close();
  expect(errors).toEqual([]);
});

test.describe("daily wallpaper cycle", () => {
  test.use({ timezoneId: "Asia/Kolkata" });
  test("switches automatically through evening, night and morning, and refreshes after wake", async ({
    page,
    context,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.clock.install({ time: new Date("2026-10-04T16:50:00+05:30") });
    await page.goto("http://127.0.0.1:4187");
    await page.waitForFunction(() => window.aquarium?.stats().time > 1);
    await page.evaluate(() => aquarium.setPaused(true));
    await page.clock.pauseAt(new Date("2026-10-04T16:59:40+05:30"));
    await page.getByLabel("Aquarium appearance").selectOption("Daily");
    const initial = await page.evaluate(() => aquarium.stats());
    expect(initial.appearance.mode).toBe("Daily");
    expect(initial.appearance.resolved).toBe("Day");
    await page.clock.fastForward(25000);
    await page.clock.runFor(50);
    let state = await page.evaluate(() => aquarium.stats());
    expect(state.appearance.resolved).toBe("Planet X");
    expect(state.waterReflection.captures).toBeGreaterThan(
      initial.waterReflection.captures,
    );
    expect(state.time).toBe(initial.time);
    await page.clock.fastForward("04:00:00");
    expect(
      await page.evaluate(() => aquarium.stats().appearance.resolved),
    ).toBe("Night");
    await page.clock.fastForward("10:00:00");
    expect(
      await page.evaluate(() => aquarium.stats().appearance.resolved),
    ).toBe("Day");
    // A time jump while asleep has no elapsed-animation dependency.
    await page.evaluate(() => aquarium.hostPause(true));
    await page.clock.setSystemTime(new Date("2026-10-05T18:00:00+05:30"));
    await page.evaluate(() => aquarium.hostPause(false));
    expect(
      await page.evaluate(() => aquarium.stats().appearance.resolved),
    ).toBe("Planet X");
    expect(await page.evaluate(() => aquarium.stats().paused)).toBe(true);
    // Manual mode overrides the cycle even when a boundary passes.
    await page.getByLabel("Aquarium appearance").selectOption("Day");
    await page.clock.fastForward("04:00:00");
    expect(
      await page.evaluate(() => aquarium.stats().appearance.resolved),
    ).toBe("Day");
    await page.getByLabel("Aquarium appearance").selectOption("Daily");
    expect(
      await page.evaluate(() => aquarium.stats().appearance.resolved),
    ).toBe("Night");
    await page.clock.resume();
    await page.reload();
    await page.waitForFunction(() => window.aquarium?.stats().time > 1);
    await expect(page.getByLabel("Aquarium appearance")).toHaveValue("Daily");
    const other = await context.newPage();
    await other.goto("http://127.0.0.1:4187");
    await other.waitForFunction(() => window.aquarium?.stats().time > 1);
    expect(
      await other.evaluate(() => aquarium.stats().appearance.resolved),
    ).toBe("Night");
    await other.close();
    expect(errors).toEqual([]);
  });
});

test("solid reef blocks fish dragging and autonomous swimming stays outside the reef", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4187");
  await page.waitForFunction(() => window.aquarium?.stats().time > 1.5);
  await page.evaluate(() => window.aquarium.setPaused(true));
  const before = await page.evaluate(() => window.aquarium.stats().collisions);
  expect(before.obstacles).toBeGreaterThan(60);
  expect(before.overlaps).toBe(0);
  await page.evaluate(() => {
    const a = window.aquarium,
      p = a.targets()[0];
    a.pointer("down", p.x, p.y);
    a.pointer("move", 0.08, 0.85);
    a.pointer("up", 0.08, 0.85);
  });
  const dragged = await page.evaluate(() => window.aquarium.stats());
  expect(dragged.lastInteraction).toBe("fish-drag");
  expect(dragged.collisions.overlaps).toBe(0);
  expect(dragged.collisions.contacts).toBeGreaterThan(before.contacts);
  await page.evaluate(() => window.aquarium.setPaused(false));
  const overlaps = await page.evaluate(async () => {
    let max = 0;
    const until = performance.now() + 12000;
    await new Promise((resolve) => {
      function tick() {
        max = Math.max(max, window.aquarium.stats().collisions.overlaps);
        if (performance.now() < until) requestAnimationFrame(tick);
        else resolve();
      }
      tick();
    });
    return max;
  });
  expect(overlaps).toBe(0);
});

test("wallpaper bridge targets independent full-display views", async ({ browser }) => {
  const errors = [];
  const contexts = [];
  try {
    const views = [];
    for (const viewport of [
      { width: 1728, height: 1117 },
      { width: 3008, height: 1692 },
    ]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      contexts.push(context);
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto("http://127.0.0.1:4187");
      await page.waitForFunction(() => window.aquarium?.stats().time > 0.3);
      await page.evaluate(() => {
        aquarium.wallpaper(true);
        aquarium.setQuality("Eco");
        aquarium.hostPause(false);
        aquarium.setPaused(true);
      });
      await expect(page.locator("#panel")).toBeHidden();
      const rect = await page.locator("canvas").first().boundingBox();
      expect(rect).toEqual({ x: 0, y: 0, ...viewport });
      views.push(page);
    }
    const [first, second] = views;
    const untouched = await first.evaluate(() => aquarium.stats());
    // A down/up pair from the native monitor must activate a fish, not just DOM clicks.
    await second.evaluate(() => {
      aquarium.setPaused(false);
      const p = aquarium.targets()[0];
      aquarium.pointer("down", p.x, p.y);
      aquarium.pointer("up", p.x, p.y);
    });
    await second.waitForFunction(() => aquarium.stats().maxShy > 0.05);
    expect(await second.evaluate(() => aquarium.stats().lastInteraction)).toBe("fish");
    await second.evaluate(() => aquarium.setPaused(true));
    const before = await second.evaluate(() => aquarium.stats());
    await second.evaluate(() => {
      const p = aquarium.targets()[0];
      aquarium.pointer("down", p.x, p.y);
      aquarium.pointer("move", p.x + 0.06, p.y - 0.08);
      aquarium.pointer("up", p.x + 0.06, p.y - 0.08);
    });
    const dragged = await second.evaluate(() => aquarium.stats());
    expect(dragged.lastInteraction).toBe("fish-drag");
    expect(dragged.fishStates[0].position).not.toEqual(before.fishStates[0].position);
    expect(dragged.collisions.overlaps).toBe(0);
    await second.evaluate(() => {
      aquarium.pointer("down", 0.5, 0.08);
      aquarium.pointer("move", 0.65, 0.12);
      aquarium.pointer("up", 0.65, 0.12);
      aquarium.zoom(0.8);
    });
    const moved = await second.evaluate(() => aquarium.stats());
    expect(moved.navigation.target).not.toEqual(before.navigation.target);
    expect(moved.navigation.distance).toBeLessThan(before.navigation.distance);
    const firstAfter = await first.evaluate(() => aquarium.stats());
    expect(firstAfter.navigation).toEqual(untouched.navigation);
    expect(firstAfter.fishStates[0].position).toEqual(untouched.fishStates[0].position);
    // Reconfiguration fills the new viewport while retaining this view's camera.
    await second.setViewportSize({ width: 2560, height: 1440 });
    await expect.poll(() => second.locator("canvas").first().boundingBox()).toEqual({ x: 0, y: 0, width: 2560, height: 1440 });
    expect(await second.evaluate(() => aquarium.stats().navigation)).toEqual(moved.navigation);
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
  }
});
