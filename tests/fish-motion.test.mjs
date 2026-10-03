import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  makeRoute,
  sampleRoute,
  animateFish,
  triggerShy,
  beginFishDrag,
  endFishDrag,
  makeCruiseRoute,
} from "../src/fish-motion.js";
function fish() {
  const route = makeRoute(0, 4, 1, 7.1, 0.95);
  return {
    group: new T.Group(),
    route,
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
test("14.2 metre cruises have continuous tangents through each U-turn", () => {
  const r = makeRoute(0, 4, 1, 7.1, 0.95);
  assert.equal(r.length, 14.2);
  for (const s of [r.length, r.length + r.arc, r.length * 2 + r.arc, r.total]) {
    const a = sampleRoute(r, s - 1e-5),
      b = sampleRoute(r, s + 1e-5);
    assert.ok(a.position.distanceTo(b.position) < 0.0001);
    assert.ok(a.tangent.dot(b.tangent) > 0.9999);
  }
  const f = fish();
  for (let i = 0; i < 2400; i++) animateFish([f], i / 60, 1 / 60);
  assert.equal(
    f.headingDirection.x,
    1,
    "no reversal during a 40 second cruise",
  );
});

test("organic cruises vary depth and height, retain continuous tangents and resume from a drop", () => {
  for (let seed = 1; seed <= 44; seed++) {
    const start = new T.Vector3(-5 + (seed % 10), 3 + (seed % 4), -2);
    const dir = new T.Vector3(seed % 2 ? 1 : -1, 0.035, 0.16).normalize();
    const route = makeCruiseRoute(start, dir, seed);
    assert.ok(sampleRoute(route, 0).position.distanceTo(start) < 1e-6);
    assert.ok(sampleRoute(route, 0).tangent.dot(dir) > 0.999);
    let minY = Infinity,
      maxY = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (let s = 0; s < route.total; s += 0.07) {
      const a = sampleRoute(route, s),
        b = sampleRoute(route, s + 0.01);
      assert.ok(
        a.position.distanceTo(b.position) < 0.022,
        "arc-length motion stays smooth",
      );
      assert.ok(a.tangent.dot(b.tangent) > 0.94, "no instantaneous reversals");
      assert.ok(Math.abs(a.position.x) < 10.5);
      minY = Math.min(minY, a.position.y);
      maxY = Math.max(maxY, a.position.y);
      minZ = Math.min(minZ, a.position.z);
      maxZ = Math.max(maxZ, a.position.z);
    }
    assert.ok(maxY - minY > 0.3);
    assert.ok(maxZ - minZ > 1);
    const f = fish();
    f.index = seed;
    f.route = route;
    f.group.position.copy(start);
    f.headingDirection.copy(dir);
    beginFishDrag(f);
    f.group.position.set(7, 4, 2);
    endFishDrag(f);
    const before = f.group.position.clone();
    animateFish([f], 1, 1 / 60);
    assert.ok(f.group.position.distanceTo(before) < 0.02);
    assert.ok(f.headingDirection.x < 0, "edge release swims inward");
  }
});

test("irritated clicks briefly speed up strokes and forward travel, then return to cruising", () => {
  const normal = fish(),
    clicked = fish();
  for (const f of [normal, clicked]) {
    f.stroke = { value: 0 };
    f.fins = [{ pivot: new T.Group(), side: 1 }];
  }
  triggerShy(clicked);
  for (let i = 0; i < 72; i++) {
    animateFish([normal, clicked], i / 60, 1 / 60);
    const expected = sampleRoute(clicked.route, clicked.routeDistance).position;
    assert.ok(
      clicked.group.position.distanceTo(expected) < 1e-10,
      "no position jiggle outside the swimming route",
    );
  }
  assert.ok(clicked.routeDistance > normal.routeDistance * 1.65);
  assert.ok(clicked.routeDistance < normal.routeDistance * 2.0);
  assert.ok(clicked.stroke.value > normal.stroke.value * 2.0);
  assert.equal(clicked.shy.value, 0);
  const before = clicked.routeDistance - normal.routeDistance;
  for (let i = 72; i < 150; i++) animateFish([normal, clicked], i / 60, 1 / 60);
  assert.ok(
    Math.abs(clicked.routeDistance - normal.routeDistance - before) < 1e-10,
    "speed returns to cruising",
  );
  const fins = clicked.fins[0].pivot.rotation.toArray();
  beginFishDrag(clicked);
  animateFish([clicked], 3, 0.2);
  assert.notDeepEqual(clicked.fins[0].pivot.rotation.toArray(), fins);
});
test("shy response stays horizontal without vertical bobbing or roll", () => {
  const f = fish();
  triggerShy(f);
  let peak = 0;
  for (let i = 0; i < 180; i++) {
    animateFish([f], i / 60, 1 / 60);
    assert.equal(f.group.position.y, 4);
    assert.equal(f.group.rotation.z, 0);
    peak = Math.max(peak, f.shy.value);
  }
  assert.ok(peak > 0.6);
  assert.equal(f.shy.value, 0);
});
test("dragging suspends swimming and release reanchors the route without a jump", () => {
  const f = fish();
  animateFish([f], 0, 1 / 60);
  beginFishDrag(f);
  f.group.position.set(5, 3.2, 2);
  for (let i = 0; i < 60; i++) animateFish([f], i / 60, 1 / 60);
  assert.deepEqual(f.group.position.toArray(), [5, 3.2, 2]);
  endFishDrag(f);
  const before = f.group.position.clone();
  animateFish([f], 2, 1 / 60);
  assert.ok(f.group.position.distanceTo(before) < 0.02);
  assert.equal(f.group.position.y, 3.2);
  assert.equal(
    f.headingDirection.x,
    -1,
    "cruises inward rather than immediately turning at the edge",
  );
  for (const x of [-8, 8]) {
    beginFishDrag(f);
    f.group.position.set(x, 3.2, 2);
    endFishDrag(f);
    const released = f.group.position.clone();
    animateFish([f], 3, 1 / 60);
    assert.ok(
      f.group.position.distanceTo(released) < 0.02,
      "release at the drag limit stays continuous",
    );
    assert.equal(f.headingDirection.x, x < 0 ? 1 : -1);
  }
});

test("a 1.1 second click burst cannot be extended by repeated clicks", () => {
  const f = fish();
  triggerShy(f);
  for (let i = 0; i < 111; i++) {
    animateFish([f], i * 0.01, 0.01);
    if (i < 108) triggerShy(f);
  }
  assert.equal(f.shy.value, 0);
  assert.equal(f.reaction, 0);
});

test("foreground swimmers revisit the glass across repeated cruises; distant swimmers keep their depth", () => {
  for (const depthBand of ["foreground", "distant"]) {
    const f = fish();
    f.index = 0;
    f.depthBand = depthBand;
    f.speed = 2.5;
    f.group.position.set(0, 4, depthBand === "foreground" ? 4.8 : -3.5);
    f.route = makeCruiseRoute(
      f.group.position,
      f.headingDirection,
      17,
      depthBand,
    );
    const visits = new Map();
    for (let i = 0; i < 18000; i++) {
      animateFish([f], i / 60, 1 / 60);
      const lap = f.laps || 0;
      visits.set(
        lap,
        Math.max(visits.get(lap) ?? -Infinity, f.group.position.z),
      );
      if (depthBand === "distant") assert.ok(f.group.position.z < 0);
    }
    assert.ok(f.laps >= 5);
    if (depthBand === "foreground")
      for (let lap = 0; lap < f.laps; lap++)
        assert.ok(
          visits.get(lap) > 5.8,
          "each completed cruise returns close to the glass",
        );
  }
});

// At the response peak, the new forward speed doubles the previous 1.38x
// response, then decays over the same short duration without a position jump.
test("click peak doubles the previous burst speed and remains frame-rate independent", () => {
  for (const hz of [12, 30, 60, 120]) {
    const f = fish();
    f.reaction = 1.03 + 1 / hz;
    animateFish([f], 0.07, 1 / hz);
    const multiplier = f.routeDistance / (f.speed / hz);
    assert.ok(Math.abs(multiplier - 2.76) < 1e-8);
    assert.equal(f.group.position.y, 4);
  }
});
