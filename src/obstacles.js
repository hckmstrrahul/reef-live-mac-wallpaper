import * as T from "three";
const delta = new T.Vector3(),
  probe = new T.Vector3(),
  candidate = new T.Vector3();
const UP = new T.Vector3(0, 1, 0);

// Conservative collision envelopes surround the rendered reef meshes. Swept
// sphere tests use the fish's full animated extent, so even a long frame or a
// rapid pointer drag cannot jump through a thin rock/coral surface.
export class ObstacleField {
  constructor(boxes = []) {
    this.boxes = boxes;
    this.bounds = new T.Box3(
      new T.Vector3(-11, 0.3, -20),
      new T.Vector3(11, 8.15, 8.2),
    );
    this.contacts = 0;
    this.result = { fraction: 1, normal: new T.Vector3() };
  }
  blocked(p, r) {
    if (
      p.x - r < this.bounds.min.x ||
      p.x + r > this.bounds.max.x ||
      p.y - r < this.bounds.min.y ||
      p.y + r > this.bounds.max.y ||
      p.z - r < this.bounds.min.z ||
      p.z + r > this.bounds.max.z
    )
      return true;
    return this.boxes.some(
      (b) =>
        p.x > b.min.x - r &&
        p.x < b.max.x + r &&
        p.y > b.min.y - r &&
        p.y < b.max.y + r &&
        p.z > b.min.z - r &&
        p.z < b.max.z + r,
    );
  }
  hit(start, end, r) {
    delta.subVectors(end, start);
    let fraction = 1,
      normal = this.result.normal;
    normal.set(0, 0, 0);
    for (const box of this.boxes) {
      if (
        Math.max(start.x, end.x) < box.min.x - r ||
        Math.min(start.x, end.x) > box.max.x + r ||
        Math.max(start.y, end.y) < box.min.y - r ||
        Math.min(start.y, end.y) > box.max.y + r ||
        Math.max(start.z, end.z) < box.min.z - r ||
        Math.min(start.z, end.z) > box.max.z + r
      )
        continue;
      let entry = -Infinity,
        leave = Infinity,
        axis = "",
        sign = 0;
      for (const a of ["x", "y", "z"]) {
        const low = box.min[a] - r,
          high = box.max[a] + r,
          d = delta[a];
        if (Math.abs(d) < 1e-10) {
          if (start[a] <= low || start[a] >= high) {
            leave = -Infinity;
            break;
          }
          continue;
        }
        let t0 = (low - start[a]) / d,
          t1 = (high - start[a]) / d;
        const n = d > 0 ? -1 : 1;
        if (t0 > t1) [t0, t1] = [t1, t0];
        if (t0 > entry) {
          entry = t0;
          axis = a;
          sign = n;
        }
        leave = Math.min(leave, t1);
      }
      if (entry < 0 && leave >= 0 && entry <= leave) {
        // A fish may be inside the look-ahead safety margin while still outside
        // the solid. Favor departure from its nearest face instead of ignoring it.
        let distance = Infinity,
          exitAxis = "",
          exitSign = 0;
        for (const a of ["x", "y", "z"]) {
          const low = start[a] - (box.min[a] - r),
            high = box.max[a] + r - start[a];
          if (low < distance) {
            distance = low;
            exitAxis = a;
            exitSign = -1;
          }
          if (high < distance) {
            distance = high;
            exitAxis = a;
            exitSign = 1;
          }
        }
        if (delta[exitAxis] * exitSign < -1e-8) {
          fraction = 0;
          normal.set(0, 0, 0);
          normal[exitAxis] = exitSign;
        }
      }
      if (entry <= leave && entry >= -1e-7 && entry < fraction && leave >= 0) {
        fraction = Math.max(0, entry);
        normal.set(0, 0, 0);
        normal[axis] = sign;
      }
    }
    for (const a of ["x", "y", "z"]) {
      const d = delta[a];
      if (Math.abs(d) < 1e-10) continue;
      const boundary = d > 0 ? this.bounds.max[a] - r : this.bounds.min[a] + r;
      const t = (boundary - start[a]) / d;
      if (t >= -1e-7 && t < fraction) {
        fraction = Math.max(0, t);
        normal.set(0, 0, 0);
        normal[a] = d > 0 ? -1 : 1;
      }
    }
    this.result.fraction = fraction;
    return this.result;
  }
  move(start, end, r, out = new T.Vector3()) {
    out.copy(start);
    const remaining = end.clone().sub(start);
    for (let i = 0; i < 4 && remaining.lengthSq() > 1e-10; i++) {
      const hit = this.hit(out, probe.copy(out).add(remaining), r);
      if (hit.fraction >= 1) {
        out.add(remaining);
        break;
      }
      this.contacts++;
      const safe = Math.max(
        0,
        hit.fraction - 0.001 / Math.max(0.001, remaining.length()),
      );
      out.addScaledVector(remaining, safe);
      remaining.multiplyScalar(1 - safe);
      remaining.addScaledVector(
        hit.normal,
        -Math.min(0, remaining.dot(hit.normal)),
      );
    }
    return out;
  }
  place(p, r) {
    if (!this.blocked(p, r)) return p;
    const original = p.clone();
    // Initialization only: nearest free shell with an upward/front preference.
    for (let distance = 0.15; distance < 24; distance += 0.15) {
      for (let i = 0; i < 42; i++) {
        const y = 1 - (2 * (i + 0.5)) / 42,
          a = i * 2.399963,
          rad = Math.sqrt(1 - y * y);
        candidate
          .set(Math.cos(a) * rad, y, Math.sin(a) * rad)
          .multiplyScalar(distance)
          .add(original);
        if (!this.blocked(candidate, r)) {
          p.copy(candidate);
          return p;
        }
      }
    }
    throw new Error("No clear swimming volume for fish");
  }
  steer(p, preferred, heading, r, speed) {
    const look = Math.max(1.25, r * 2.5 + speed * 1.1);
    const clearance = (d) =>
      this.hit(p, probe.copy(p).addScaledVector(d, look), r + 0.1).fraction;
    if (clearance(preferred) > 0.99) return preferred;
    let best = -Infinity;
    const chosen = preferred.clone();
    for (const yaw of [0, -0.5, 0.5, -1, 1, -1.5, 1.5, Math.PI])
      for (const pitch of [0, 0.55, -0.55]) {
        const d = preferred.clone().applyAxisAngle(UP, yaw);
        d.y += pitch;
        d.normalize();
        const free = clearance(d);
        const score = free * 5 + d.dot(preferred) * 0.7 + d.dot(heading) * 0.8;
        if (score > best) {
          best = score;
          chosen.copy(d);
        }
      }
    return chosen;
  }
}
export function reefObstacles(interactables) {
  const boxes = [];
  for (const mesh of interactables) {
    // The bed is a bounded plane; soft foliage is not a rigid obstacle.
    if (/sand|seagrass|aquatic|plant|stem/i.test(mesh.name)) continue;
    mesh.updateWorldMatrix(true, false);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox
      .clone()
      .applyMatrix4(mesh.matrixWorld);
    box.expandByScalar(/anemone|fan/i.test(mesh.name) ? 0.12 : 0.035);
    boxes.push(box);
  }
  return new ObstacleField(boxes);
}
