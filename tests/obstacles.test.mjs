import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { ObstacleField } from "../src/obstacles.js";
import {
  animateFish,
  makeCruiseRoute,
  triggerShy,
} from "../src/fish-motion.js";
const v = (x, y, z) => new T.Vector3(x, y, z);
const box = (a, b) => new T.Box3(v(...a), v(...b));
test("swept collision prevents tunnelling through a thin reef surface and slides along it", () => {
  const world = new ObstacleField([box([0, 0.3, -2], [0.025, 5, 2])]);
  for (const radius of [0.12, 0.4, 0.85]) {
    const start = v(-3, 2, 0),
      end = v(8, 4, 0),
      p = world.move(start, end, radius);
    assert.ok(p.x <= -radius);
    assert.ok(p.y > 2);
    assert.equal(world.blocked(p, radius), false);
    const alias = start.clone();
    world.move(alias, end, radius, alias);
    assert.ok(
      alias.distanceTo(p) < 1e-9,
      "dragging may use the same input/output vector",
    );
  }
});
test("closed corners, the bed and initialization remain nonpenetrating", () => {
  const world = new ObstacleField([
    box([0, 0.3, -3], [1, 5, 2]),
    box([-3, 0.3, 1], [1, 5, 2]),
  ]);
  for (let i = 0; i < 40; i++) {
    const p = world.place(v(0.5, 1.5, 1.5), 0.4);
    assert.equal(world.blocked(p, 0.4), false);
    for (let j = 0; j < 30; j++) {
      const end = v(
        Math.sin(j * 2.3 + i) * 15,
        Math.cos(j * 0.9) * 10,
        Math.cos(j * 1.1 + i) * 15,
      );
      world.move(p, end, 0.4, p);
      assert.equal(world.blocked(p, 0.4), false);
    }
  }
});
test("cruising fish steer around rocks without penetrating during click bursts at varied frame rates", () => {
  for (const fps of [12, 30, 60, 120]) {
    const world = new ObstacleField([
      box([-0.7, 0.3, -1.2], [1.2, 5, 1.2]),
      box([4, 0.3, -4], [5.5, 3.4, 0.6]),
    ]);
    const group = new T.Group();
    group.position.set(-3, 3, 0.1);
    const headingDirection = v(1, 0, 0),
      f = {
        group,
        index: 1,
        route: makeCruiseRoute(group.position, headingDirection, 1),
        routeDistance: 0,
        headingDirection,
        time: { value: 0 },
        shy: { value: 0 },
        phase: { value: 0 },
        swimRate: { value: 1 },
        stroke: { value: 0 },
        bend: { value: 0 },
        reaction: 0,
        speed: 0.7,
        resume: 1,
        dragging: false,
        obstacles: world,
        collisionRadius: 0.35,
      };
    let moved = 0,
      detour = 0;
    for (let i = 0; i < fps * 60; i++) {
      if (i % (fps * 7) === 0) triggerShy(f);
      const before = f.group.position.clone();
      animateFish([f], i / fps, 1 / fps);
      assert.equal(
        world.blocked(f.group.position, f.collisionRadius),
        false,
        `overlap at ${fps} fps step ${i}`,
      );
      const distance = before.distanceTo(f.group.position);
      moved += distance;
      assert.ok(
        distance <= (f.speed * 1.17 * 2.76) / fps + 0.0001,
        "movement stays within the peak burst speed",
      );
      detour = Math.max(detour, Math.abs(f.group.position.z));
    }
    assert.ok(moved > 15, "fish keep making progress");
    assert.ok(detour > 1.5, "course goes around the rock");
  }
});
