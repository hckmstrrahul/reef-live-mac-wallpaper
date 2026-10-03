import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { settleOnMesh } from "../src/grounding.js";
test("a rotated colony settles onto the real support surface and remains settled", () => {
  const support = new T.Mesh(new T.BoxGeometry(4, 1, 4));
  support.position.y = 0.5;
  const colony = new T.Group();
  colony.position.set(0.2, 4, 0.3);
  const mesh = new T.Mesh(new T.BoxGeometry(1, 0.6, 1.2));
  mesh.rotation.z = 0.23;
  colony.add(mesh);
  const result = settleOnMesh(colony, support);
  assert.ok(result.loweredBy > 2.5);
  assert.ok(result.contacts > 0);
  const bounds = new T.Box3().setFromObject(colony);
  assert.ok(Math.abs(bounds.min.y - 0.965) < 1e-6);
  assert.ok(Math.abs(settleOnMesh(colony, support).loweredBy) < 1e-6);
});
