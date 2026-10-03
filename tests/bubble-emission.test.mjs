import { test } from "node:test";
import assert from "node:assert/strict";
import { BubbleEmission } from "../src/bubble-emission.js";
function system() {
  let seed = 39821;
  const random = () =>
    (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
  return new BubbleEmission(
    Array.from({ length: 12 }, (_, i) => [i * 2, 0, i % 3]),
    random,
  );
}
test("six staggered vents rotate through locations with tiny, medium and large bubbles", () => {
  const s = system(),
    records = [],
    visited = new Set(),
    last = new Map();
  for (let i = 0; i < 7200; i++)
    s.tick(1 / 60, (p, r) => {
      records.push(r);
      visited.add(p[0]);
      if (last.has(p[0]))
        assert.ok(
          s.time - last.get(p[0]) >= 0.38,
          "individual outlets do not spawn clumps",
        );
      last.set(p[0], s.time);
      return true;
    });
  assert.equal(s.vents.length, 6);
  assert.equal(new Set(s.vents.map((v) => v.site)).size, 6);
  assert.ok(visited.size >= 10);
  assert.ok(records.length > 400 && records.length < 1000);
  assert.ok(Math.min(...records) < 0.02 && Math.max(...records) > 0.19);
  for (const valid of [
    (r) => r < 0.05,
    (r) => r >= 0.05 && r < 0.11,
    (r) => r >= 0.11,
  ])
    assert.ok(records.filter(valid).length > 40);
});
test("click releases are staggered and long frames cannot dump catch-up bubble piles", () => {
  const s = system(),
    times = [];
  s.burst([99, 0, 99], 20);
  for (let i = 0; i < 600; i++)
    s.tick(0.01, (p) => {
      if (p[0] === 99) times.push(s.time);
      return true;
    });
  assert.equal(times.length, 20);
  assert.ok(times.at(-1) - times[0] > 1.2);
  for (let i = 1; i < times.length; i++)
    assert.ok(times[i] - times[i - 1] >= 0.05);
  let emitted = 0;
  s.tick(5, () => {
    emitted++;
    return true;
  });
  assert.ok(emitted <= 6);
});
