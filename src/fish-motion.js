import * as T from "three";

// Long horizontal cruises joined by broad, tangent-continuous half-circle turns.
// Distance is integrated, so dragging can start a new route without teleporting.
export function makeRoute(
  centerX,
  laneY,
  centerZ,
  halfLength = 6.2,
  radius = 0.95,
) {
  const length = halfLength * 2,
    arc = Math.PI * radius;
  return {
    centerX,
    laneY,
    centerZ,
    halfLength,
    radius,
    length,
    arc,
    total: length * 2 + arc * 2,
  };
}
export function sampleRoute(
  route,
  distance,
  out = new T.Vector3(),
  tangent = new T.Vector3(),
) {
  if (route.curve) {
    const u = T.MathUtils.clamp(distance / route.total, 0, 1);
    route.curve.getPointAt(u, out);
    route.curve.getTangentAt(u, tangent).normalize();
    return { position: out, tangent };
  }
  const r = route,
    s = ((distance % r.total) + r.total) % r.total;
  let x, z, dx, dz;
  if (s < r.length) {
    x = -r.halfLength + s;
    z = -r.radius;
    dx = 1;
    dz = 0;
  } else if (s < r.length + r.arc) {
    const a = (s - r.length) / r.radius - Math.PI / 2;
    x = r.halfLength + r.radius * Math.cos(a);
    z = r.radius * Math.sin(a);
    dx = -Math.sin(a);
    dz = Math.cos(a);
  } else if (s < r.length * 2 + r.arc) {
    x = r.halfLength - (s - r.length - r.arc);
    z = r.radius;
    dx = -1;
    dz = 0;
  } else {
    const a = (s - r.length * 2 - r.arc) / r.radius + Math.PI / 2;
    x = -r.halfLength + r.radius * Math.cos(a);
    z = r.radius * Math.sin(a);
    dx = -Math.sin(a);
    dz = Math.cos(a);
  }
  out.set(r.centerX + x, r.laneY, r.centerZ + z);
  tangent.set(dx, 0, dz);
  return { position: out, tangent };
}
// Seeded, arc-length sampled 3D cruises: long crossings with independent depths,
// gradual ascents and wide turns. Each lap changes its future course continuously.
export function makeCruiseRoute(
  position,
  direction,
  seed = 1,
  depthBand = "middle",
) {
  let state = (seed * 7919 + 104729) >>> 0;
  const random = () =>
    (state = (1664525 * state + 1013904223) >>> 0) / 4294967296;
  const sign = direction.x >= 0 ? 1 : -1;
  const p = position.clone();
  const low = Math.max(2.2, p.y - 0.85),
    high = Math.min(7.7, p.y + 0.85);
  const level = () => low + random() * Math.max(0.05, high - low);
  const edge = 7.3 + random() * 0.3;
  // Routes revisit a stable depth range instead of inheriting the previous
  // lap's depth and gradually retreating to the back of the tank.
  const range =
    depthBand === "foreground"
      ? [6.5, 4.1]
      : depthBand === "distant"
        ? [-1.4, -6.2]
        : [4.8, 1.25];
  const front = range[0] + random() * 0.55,
    back = range[1] - random() * 0.7;
  const mid = (front + back) * 0.5;
  const lead = direction.clone().normalize().multiplyScalar(1.35);
  const points = [
    p,
    p.clone().add(lead),
    new T.Vector3(sign * edge, level(), front + random() * 0.25),
    new T.Vector3(sign * (edge + 1.0), level(), mid),
    new T.Vector3(sign * edge, level(), back),
    new T.Vector3(0, level(), back - random() * 0.25),
    new T.Vector3(-sign * edge, level(), back),
    new T.Vector3(-sign * (edge + 1.0), level(), mid),
    new T.Vector3(-sign * edge, level(), front),
    new T.Vector3(-sign * 3.5, level(), front),
  ];
  // An open course is renewed at its end: a drop point need never become a
  // forced closing waypoint, which would introduce a hairpin near the glass.
  const curve = new T.CatmullRomCurve3(points, false, "centripetal");
  curve.arcLengthDivisions = 480;
  curve.updateArcLengths();
  return { curve, total: curve.getLength(), laneY: p.y, seed, depthBand };
}
export function triggerShy(f) {
  // Ignore a retrigger during the same reflex; never restart the swimming phase.
  if (f.reaction > 0) return;
  f.reaction = 1.1;
}
export function beginFishDrag(f) {
  f.dragging = true;
  f.reaction = 0;
}
export function endFishDrag(f) {
  f.dragging = false;
  if (f.route.curve) {
    const direction = f.headingDirection.clone();
    // After moving to an edge, steer into the open water rather than the glass.
    direction.x =
      f.group.position.x > 5 ? -1 : f.group.position.x < -5 ? 1 : direction.x;
    direction.y *= 0.3;
    f.route = makeCruiseRoute(
      f.group.position,
      direction,
      f.index + 101 + (f.laps || 0),
      f.depthBand || f.route.depthBand,
    );
    f.routeDistance = 0;
    f.resume = 0;
    return;
  }
  // Re-anchor the lane at the drop point; travel at least 6 m before a turn.
  const p = f.group.position;
  const right = p.x < 0;
  const half = Math.max(7.6, Math.abs(p.x) + 0.35),
    centerX = 0;
  f.route = makeRoute(centerX, p.y, p.z + (right ? 0.95 : -0.95), half, 0.95);
  f.routeDistance = right
    ? p.x - centerX + half
    : f.route.length + f.route.arc + (half - (p.x - centerX));
  f.resume = 0;
}
const next = new T.Vector3(),
  tangent = new T.Vector3();
export function animateFish(fishes, t, dt, reducedMotion = false) {
  for (const f of fishes) {
    f.time.value = t;
    f.reaction = Math.max(0, f.reaction - dt);
    const age = 1.1 - f.reaction;
    f.shy.value =
      f.reaction > 0
        ? T.MathUtils.smoothstep(age, 0, 0.07) *
          (1 - T.MathUtils.smoothstep(age, 0.12, 1.1)) *
          (reducedMotion ? 0.35 : 1)
        : 0;
    const effort =
      0.8 +
      0.24 * Math.sin(t * 0.65 + f.phase.value) +
      0.13 * Math.sin(t * 1.37 + f.phase.value * 2.1);
    f.swimRate.value = effort * (reducedMotion ? 0.65 : 1);
    if (f.stroke)
      f.stroke.value +=
        dt *
        ((5.2 + f.speed * 4) * f.swimRate.value + f.shy.value * 10.0) *
        (1 + f.shy.value * (reducedMotion ? 0.2 : 1));
    if (f.fins)
      for (const fin of f.fins) {
        const phase = f.stroke.value * 1.35 + fin.side * 0.5;
        fin.pivot.rotation.x =
          fin.side * (0.2 + Math.sin(phase) * 0.27 * (reducedMotion ? 0.4 : 1));
        fin.pivot.rotation.y =
          fin.side *
          (0.18 + Math.sin(phase + 0.8) * 0.22 + f.shy.value * 0.055);
      }
    if (f.dragging) {
      f.shy.value = 0;
      continue;
    }
    f.resume = Math.min(1, f.resume + dt * 0.65);
    const speed =
      f.speed *
      (0.72 + 0.28 * f.resume) *
      (reducedMotion ? 0.7 : 1) *
      (f.route.curve ? effort : 1) *
      (1 + f.shy.value * (reducedMotion ? 0.12 : 0.38)) *
      (1 + f.shy.value * (reducedMotion ? 0.2 : 1));
    f.routeDistance += dt * speed;
    sampleRoute(f.route, f.routeDistance, next, tangent);
    if (f.obstacles) {
      const before = f.group.position.clone();
      const ahead = sampleRoute(
        f.route,
        Math.min(f.route.total, f.routeDistance + 1.8),
        new T.Vector3(),
        new T.Vector3(),
      );
      const preferred = ahead.position
        .sub(before)
        .normalize()
        .multiplyScalar(0.45)
        .addScaledVector(tangent, 0.55)
        .normalize();
      const steered = f.obstacles.steer(
        before,
        preferred,
        f.headingDirection,
        f.collisionRadius,
        speed,
      );
      tangent
        .copy(f.headingDirection)
        .lerp(steered, 1 - Math.exp(-dt * 3.5))
        .normalize();
      f.obstacles.move(
        before,
        before.clone().addScaledVector(tangent, dt * speed),
        f.collisionRadius,
        f.group.position,
      );
      if (before.distanceToSquared(f.group.position) > 1e-10)
        tangent.subVectors(f.group.position, before).normalize();
      next.copy(f.group.position);
    } else f.group.position.copy(next);
    f.headingDirection.copy(tangent);
    const yaw = Math.atan2(tangent.z, -tangent.x);
    const difference = Math.atan2(
      Math.sin(yaw - f.group.rotation.y),
      Math.cos(yaw - f.group.rotation.y),
    );
    f.group.rotation.y += difference * (1 - Math.exp(-dt * 5.5));
    if (f.bend)
      f.bend.value +=
        (T.MathUtils.clamp(difference * 1.5, -0.32, 0.32) - f.bend.value) *
        (1 - Math.exp(-dt * 4));
    // Pitch tracks an actual rise/dive; no decorative vertical bobbing.
    const pitch = f.route.curve
      ? -Math.asin(T.MathUtils.clamp(tangent.y, -0.45, 0.45))
      : 0;
    f.group.rotation.z +=
      (pitch - f.group.rotation.z) * (1 - Math.exp(-dt * 4));
    if (f.route.curve && f.routeDistance >= f.route.total) {
      f.laps = (f.laps || 0) + 1;
      f.route = makeCruiseRoute(
        next,
        tangent,
        f.index + f.laps * 53,
        f.depthBand || f.route.depthBand,
      );
      f.routeDistance = 0;
    }
  }
}
