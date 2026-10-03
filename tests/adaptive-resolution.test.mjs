import { test } from "node:test";
import assert from "node:assert/strict";
import { AdaptiveResolution } from "../src/adaptive-resolution.js";
test("sustained GPU pressure reduces pixel workload within bounds, with slow recovery", () => {
  const a = new AdaptiveResolution(1.5);
  for (let i = 0; i < 20; i++) assert.equal(a.sample(1 / 40), null);
  while (a.scale === 1.5) a.sample(1 / 40);
  assert.ok(a.scale <= 1.25 && a.scale >= 1);
  const scale = a.scale;
  for (let i = 0; i < 600; i++) a.sample(1 / 60);
  assert.equal(a.scale, scale, "does not oscillate upward every few seconds");
  for (let i = 0; i < 2000; i++) a.sample(1 / 25);
  assert.equal(a.scale, 1);
  a.reset(1);
  for (let i = 0; i < 2000; i++) a.sample(1 / 60);
  assert.equal(a.scale, 1);
});
test("healthy refresh and suspension leave resolution alone", () => {
  const a = new AdaptiveResolution(1.5);
  for (let i = 0; i < 1000; i++) a.sample(1 / 60);
  assert.equal(a.scale, 1.5);
  assert.equal(a.sample(5), null);
  assert.equal(a.sample(0), null);
});
