import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { FrameClock, FixedStepper } from "../src/frame-clock.js";
import { animateFish, makeRoute } from "../src/fish-motion.js";
function fish() {
  return {
    group: new T.Group(),
    route: makeRoute(0, 4, 0, 7.1, 0.95),
    routeDistance: 0,
    headingDirection: new T.Vector3(1, 0, 0),
    time: { value: 0 },
    shy: { value: 0 },
    phase: { value: 0 },
    swimRate: { value: 1 },
    reaction: 0,
    speed: 0.35,
    resume: 1,
    dragging: false,
  };
}
test("fish cover the same distance at 12–120 Hz, including frames longer than 50 ms", () => {
  for (const hz of [12, 20, 30, 45, 60, 75, 90, 120]) {
    const clock = new FrameClock(),
      f = fish();
    let t = 0,
      frames = 0;
    for (let i = 0; i <= hz * 10; i++) {
      const dt = clock.tick((i * 1000) / hz);
      if (dt !== null) {
        t += dt;
        animateFish([f], t, dt);
        frames++;
      }
    }
    assert.ok(Math.abs(t - 10) < 1e-8, `${hz} Hz keeps elapsed time`);
    assert.ok(
      Math.abs(f.routeDistance - 3.5) < 1e-8,
      `${hz} Hz keeps swimming speed`,
    );
    assert.equal(frames, hz * 10 + 1, "High does not skip refreshes");
  }
});
test("Eco keeps its fractional frame budget on 60, 75 and 120 Hz displays", () => {
  for (const hz of [60, 75, 120]) {
    const clock = new FrameClock();
    let t = 0,
      frames = 0;
    for (let i = 0; i <= hz * 10; i++) {
      const dt = clock.tick((i * 1000) / hz, true, 30);
      if (dt !== null && dt > 0) {
        t += dt;
        frames++;
      }
    }
    assert.ok(
      Math.abs(frames - 300) <= 1,
      `${hz} Hz produced ${frames} frames`,
    );
    assert.ok(Math.abs(t - 10) < 1 / 30 + 1e-8);
  }
});
test("pause, hidden views and long system suspension do not cause catch-up jumps", () => {
  const clock = new FrameClock();
  clock.tick(0);
  assert.equal(clock.tick(100), 0.1);
  assert.equal(clock.tick(200, false), null);
  assert.equal(clock.tick(12000, true), 0);
  assert.equal(clock.tick(12020, true), 0.02);
  clock.suspend();
  assert.equal(clock.tick(50000), 0);
  assert.equal(clock.tick(55000), 0);
  assert.equal(clock.tick(55020), 0.02);
});
test("fluid catch-up is bounded independently of fish time and retains fractional time", () => {
  const clock = new FrameClock(),
    stepper = new FixedStepper();
  let simulated = 0;
  const step = (dt) => (simulated += dt);
  clock.tick(0);
  const dt = clock.tick(250);
  assert.equal(dt, 0.25);
  assert.equal(stepper.advance(dt, step), 3);
  assert.ok(Math.abs(simulated - 0.1) < 1e-8);
  assert.equal(stepper.advance(1 / 60, step), 1);
  assert.ok(stepper.remaining < 1 / 30);
});
