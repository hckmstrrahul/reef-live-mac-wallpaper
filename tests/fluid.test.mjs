import { test } from "node:test";
import assert from "node:assert/strict";
import { CurrentField } from "../src/fluid.js";
test("pressure projection reduces velocity divergence", () => {
  const f = new CurrentField();
  f.impulse(-2, 4, -2, 1, 0.7, -0.4, 2);
  const before = f.divergence();
  f.project(50);
  assert.ok(f.divergence() < before * 0.8, `${before} -> ${f.divergence()}`);
});
test("current field stays bounded and finite under repeated bubble impulses", () => {
  const f = new CurrentField();
  for (let i = 0; i < 400; i++) {
    f.impulse(-7, 1.4, -3, 0.006, 0.014, 0, 1.4);
    f.step(1 / 30);
  }
  for (const a of [f.u, f.v, f.w])
    for (const n of a) {
      assert.ok(Number.isFinite(n));
      assert.ok(Math.abs(n) < 2);
    }
  assert.equal(f.u[f.index(0, 4, 4)], 0);
  assert.equal(f.v[f.index(4, 0, 4)], 0);
  assert.equal(f.w[f.index(4, 4, 0)], 0);
  const v = f.sample(-7, 1.4, -3);
  assert.ok(v[1] > 0, "bubble stream drives an upward current");
});
