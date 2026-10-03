import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { PlantHabitat } from "../src/plant-habitat.js";

test("plant placement uses coral triangles, transformed roots, and a sway margin", () => {
  const mat = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const floor = new T.Mesh(
    new T.PlaneGeometry(20, 20).rotateX(-Math.PI / 2),
    mat,
  );
  floor.position.y = 0.25;
  floor.updateMatrixWorld(true);
  // A large sparse plane's AABB covers open space; a plant can use that space.
  const coral = new T.Mesh(new T.TorusGeometry(1, 0.15, 12, 32), mat);
  coral.position.set(2, 2, 0);
  coral.updateMatrixWorld(true);
  const habitat = new PlantHabitat([floor], [coral]);
  assert.ok(Math.abs(habitat.height(3, 4) - 0.25) < 1e-8);
  const sprig = new T.PlaneGeometry(0.08, 0.8);
  assert.equal(
    habitat.clear(sprig, new T.Vector3(2, 2, 0)),
    true,
    "open center is allowed even inside a bounding box",
  );
  assert.equal(
    habitat.clear(sprig, new T.Vector3(3, 2, 0)),
    false,
    "tissue crossing the actual coral is rejected",
  );
  assert.equal(
    habitat.clear(sprig, new T.Vector3(2.72, 2, 0)),
    false,
    "rest clearance includes the swaying blade envelope",
  );
  assert.equal(habitat.clear(sprig, new T.Vector3(-2, 2, 0)), true);
});
