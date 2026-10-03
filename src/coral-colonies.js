import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { applyWaterLight } from "./lighting.js";
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);

// Surface pitting and corallite cups are baked once, not evaluated per pixel.
export function tissueMaps(random) {
  const n = 1024,
    color = document.createElement("canvas"),
    height = document.createElement("canvas");
  color.width = color.height = height.width = height.height = n;
  const c = color.getContext("2d"),
    h = height.getContext("2d");
  c.fillStyle = "#d7d1c4";
  c.fillRect(0, 0, n, n);
  h.fillStyle = "#808080";
  h.fillRect(0, 0, n, n);
  for (let i = 0; i < 950; i++) {
    const x = random(0, n),
      y = random(0, n),
      r = random(22, 110);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, i % 2 ? "rgba(93,99,77,.09)" : "rgba(242,224,201,.12)");
    g.addColorStop(1, "rgba(150,142,119,0)");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Offset and jitter each cell; the pattern wraps across the atlas edges.
  for (let row = 0; row < 29; row++)
    for (let col = 0; col < 29; col++) {
      const px = ((col + (row % 2) * 0.5 + random(-0.29, 0.29)) * n) / 29,
        py = ((row + random(-0.29, 0.29)) * n) / 29;
      const radius = random(5, 11),
        aspect = random(0.7, 1.2);
      for (const ox of [-n, 0, n])
        for (const oy of [-n, 0, n]) {
          const x = px + ox,
            y = py + oy;
          if (x < -20 || y < -20 || x > n + 20 || y > n + 20) continue;
          c.save();
          h.save();
          c.translate(x, y);
          h.translate(x, y);
          c.scale(1, aspect);
          h.scale(1, aspect);
          c.strokeStyle = "rgba(245,237,214,.75)";
          c.lineWidth = radius * 0.27;
          c.beginPath();
          c.arc(0, 0, radius, 0, Math.PI * 2);
          c.stroke();
          c.fillStyle = "rgba(85,78,63,.50)";
          c.beginPath();
          c.arc(0, 0, radius * 0.61, 0, Math.PI * 2);
          c.fill();
          const g = h.createRadialGradient(0, 0, 0, 0, 0, radius * 1.45);
          g.addColorStop(0, "#4a4a4a");
          g.addColorStop(0.38, "#686868");
          g.addColorStop(0.62, "#bdbdbd");
          g.addColorStop(1, "#808080");
          h.fillStyle = g;
          h.beginPath();
          h.arc(0, 0, radius * 1.45, 0, Math.PI * 2);
          h.fill();
          c.strokeStyle = "rgba(239,226,195,.35)";
          c.lineWidth = 0.75;
          for (let k = 0; k < 10; k++) {
            const a = (k * Math.PI) / 5;
            c.beginPath();
            c.moveTo(Math.cos(a) * radius * 0.33, Math.sin(a) * radius * 0.33);
            c.lineTo(Math.cos(a) * radius * 0.93, Math.sin(a) * radius * 0.93);
            c.stroke();
          }
          c.restore();
          h.restore();
        }
    }
  for (let i = 0; i < 32000; i++) {
    c.fillStyle = i % 2 ? "rgba(73,69,52,.08)" : "rgba(255,246,221,.14)";
    c.fillRect(random(0, n), random(0, n), random(0.4, 1.3), random(0.4, 1.3));
  }
  const pixels = h.getImageData(0, 0, n, n).data,
    normal = new Uint8Array(n * n * 4),
    rough = new Uint8Array(n * n * 4);
  const read = (x, y) => pixels[(((y + n) % n) * n + ((x + n) % n)) * 4] / 255;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = (read(x + 1, y) - read(x - 1, y)) * 2.4,
        dy = (read(x, y + 1) - read(x, y - 1)) * 2.4;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1),
        i = (y * n + x) * 4;
      normal[i] = (0.5 - dx * inv * 0.5) * 255;
      normal[i + 1] = (0.5 + dy * inv * 0.5) * 255;
      normal[i + 2] = (0.5 + inv * 0.5) * 255;
      normal[i + 3] = 255;
      rough[i] =
        rough[i + 1] =
        rough[i + 2] =
          Math.round(185 + read(x, y) * 53);
      rough[i + 3] = 255;
    }
  const map = new T.CanvasTexture(color);
  map.colorSpace = T.SRGBColorSpace;
  // Canvas-backed maps also survive GLTFExporter's metallic/roughness packing.
  // Both maps keep linear color space; their byte values are surface data.
  function packedTexture(bytes) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = n;
    canvas
      .getContext("2d")
      .putImageData(new ImageData(new Uint8ClampedArray(bytes), n, n), 0, 0);
    return new T.CanvasTexture(canvas);
  }
  const normalMap = packedTexture(normal),
    roughnessMap = packedTexture(rough);
  for (const t of [map, normalMap, roughnessMap]) {
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.magFilter = T.LinearFilter;
    t.needsUpdate = true;
  }
  return { map, normalMap, roughnessMap };
}
// A smooth spatial field, so pigment patches cross branches instead of repeating
// the same one-dimensional gradient separately on every limb.
function pigmentNoise(x, y, z) {
  return (
    0.5 +
    0.22 * Math.sin(x * 5.7 + y * 3.1 + z * 4.2) +
    0.15 * Math.sin(x * 13.1 - y * 9.3 + z * 11.8) +
    0.09 * Math.cos(x * 29.3 + y * 24.7 - z * 17.1)
  );
}
export function coralFactory(
  scene,
  shared,
  interactables,
  swayers,
  random,
  sharedMaps,
) {
  const maps = sharedMaps || tissueMaps(random);
  let colonyIndex = 0;
  return function colony(x, y, z, size, color, kind) {
    if (typeof kind !== "string")
      kind = kind ? "fan" : ["staghorn", "finger", "table"][colonyIndex % 3];
    colonyIndex++;
    const group = new T.Group();
    group.position.set(x, y, z);
    group.rotation.y = random(-0.7, 0.7);
    group.scale.set(random(0.89, 1.12), random(0.89, 1.09), random(0.82, 1.11));
    const geos = [],
      base = new T.Color(color),
      shadow = new T.Color("#665f49").lerp(base, 0.38),
      tip = new T.Color("#e4d9c2").lerp(base, 0.6);
    const mat = new T.MeshPhysicalMaterial({
      ...maps,
      vertexColors: true,
      roughness: 0.94,
      normalScale: new T.Vector2(0.85, 0.85),
      envMapIntensity: 0.36,
    });
    applyWaterLight(mat, shared);
    const phase = random(0, 40);
    function paint(g, brightTip = false) {
      const p = g.attributes.position,
        uv = g.attributes.uv,
        colors = new Float32Array(p.count * 3),
        c = new T.Color();
      for (let i = 0; i < p.count; i++) {
        const xx = p.getX(i),
          yy = p.getY(i),
          zz = p.getZ(i),
          height = yy / size;
        const noise = pigmentNoise(xx + phase, yy, zz - phase);
        c.copy(shadow).lerp(
          base,
          T.MathUtils.smoothstep(height, 0, 0.23) * (0.59 + 0.25 * noise),
        );
        c.lerp(
          tip,
          T.MathUtils.smoothstep(height, 0.38, 0.96) * (0.13 + 0.3 * noise),
        );
        c.multiplyScalar(0.76 + noise * 0.36);
        if (brightTip) c.lerp(tip, 0.22);
        c.toArray(colors, i * 3);
      }
      g.setAttribute("color", new T.BufferAttribute(colors, 3));
      geos.push(g);
    }
    function limb(points, r, taper = 0.4) {
      const path = new T.CatmullRomCurve3(points),
        length = path.getLength();
      const segments = Math.max(3, Math.min(12, Math.ceil(length / 0.13))),
        sides = r < size * 0.011 ? 6 : 8;
      const g = new T.TubeGeometry(path, segments, r, sides, false),
        p = g.attributes.position,
        uv = g.attributes.uv;
      const u0 = random(0, 8),
        v0 = random(0, 8);
      for (let ring = 0; ring <= segments; ring++) {
        const t = ring / segments,
          center = path.getPointAt(t),
          width = 1 - taper * t;
        for (let side = 0; side <= sides; side++) {
          const i = ring * (sides + 1) + side,
            rough = 1 + 0.055 * Math.sin(t * 17 + side * 3 + phase);
          p.setXYZ(
            i,
            center.x + (p.getX(i) - center.x) * width * rough,
            center.y + (p.getY(i) - center.y) * width * rough,
            center.z + (p.getZ(i) - center.z) * width * rough,
          );
          uv.setXY(
            i,
            u0 + (t * length) / 1.2,
            v0 + ((side / sides) * Math.PI * 2 * r) / 1.2,
          );
        }
      }
      g.computeVertexNormals();
      paint(g);
      if (kind !== "fan" && r > size * 0.017) {
        const buds = Math.min(16, Math.ceil(length / (r * 2.4)));
        for (let k = 1; k < buds; k++) {
          const t = k / buds,
            a = k * 2.39996 + phase;
          const center = path.getPointAt(t),
            tangent = path.getTangentAt(t);
          const side = V(0, 0, 1).cross(tangent).normalize();
          const other = tangent.clone().cross(side).normalize();
          const radius = r * (1 - taper * t);
          center
            .addScaledVector(side, Math.cos(a) * radius * 0.83)
            .addScaledVector(other, Math.sin(a) * radius * 0.83);
          const bud = new T.SphereGeometry(radius * random(0.3, 0.52), 5, 3);
          bud.scale(1, random(0.8, 1.3), 1);
          bud.translate(center.x, center.y, center.z);
          paint(bud);
        }
      }
      // Closed, rounded growing tip; no detached spherical 'flowers'.
      const end = points.at(-1),
        cap = new T.SphereGeometry(r * (1 - taper), 6, 4);
      cap.translate(end.x, end.y, end.z);
      paint(cap, true);
      return path;
    }
    function foot(rx, ry, rz) {
      const g = new T.SphereGeometry(1, 28, 16),
        p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const xx = p.getX(i),
          yy = p.getY(i),
          zz = p.getZ(i),
          b = 1 + 0.13 * Math.sin(xx * 9 + zz * 6) * Math.sin(zz * 12 - yy * 5);
        p.setXYZ(i, xx * rx * b, Math.max(-0.035, yy * ry * b), zz * rz * b);
      }
      g.computeVertexNormals();
      paint(g);
    }
    function grow(start, dir, len, r, depth) {
      const end = start.clone().addScaledVector(dir, len),
        mid = start
          .clone()
          .lerp(end, 0.52)
          .add(V(random(-1, 1) * len * 0.09, 0, random(-1, 1) * len * 0.09));
      const path = limb([start, mid, end], r, depth ? 0.22 : 0.28);
      if (!depth) return;
      const forward = dir
        .clone()
        .add(V(random(-0.25, 0.25), random(0.05, 0.35), random(-0.25, 0.25)))
        .normalize();
      grow(end, forward, len * random(0.55, 0.78), r * 0.78, depth - 1);
      const count = 2;
      for (let k = 0; k < count; k++) {
        const a = random(0, Math.PI * 2),
          at = random(0.32, 0.77),
          d = dir
            .clone()
            .multiplyScalar(0.28)
            .add(
              V(
                Math.cos(a) * random(0.4, 0.8),
                random(0.3, 0.78),
                Math.sin(a) * random(0.4, 0.8),
              ),
            )
            .normalize();
        grow(
          path.getPointAt(at),
          d,
          len * random(0.42, 0.7),
          r * random(0.65, 0.79),
          depth - 1,
        );
      }
    }
    if (kind === "fan") {
      const paths = [],
        arms = 29;
      for (let i = 0; i < arms; i++) {
        const a = -1.08 + (i / (arms - 1)) * 2.16 + random(-0.035, 0.035),
          length = size * random(0.72, 1.06),
          points = [];
        for (let j = 0; j < 5; j++) {
          const t = j / 4;
          points.push(
            V(
              Math.sin(a) * length * Math.pow(t, 0.84),
              Math.cos(a) * length * t + 0.08 * size * Math.sin(t * 3.14 + a),
              size * 0.04 * Math.sin(t * 7 + a * 3),
            ),
          );
        }
        paths.push(limb(points, size * random(0.0045, 0.007), 0.68));
      }
      for (let i = 0; i < arms - 1; i++)
        for (let j = 1; j < 19; j++) {
          const t = 0.13 + j * 0.043 + random(-0.013, 0.013);
          if (random() < 0.12) continue;
          const a = paths[i].getPointAt(t),
            b = paths[i + 1].getPointAt(t + random(-0.026, 0.026));
          limb(
            [
              a,
              a
                .clone()
                .lerp(b, 0.5)
                .add(V(0, random(-0.025, 0.025), random(-0.025, 0.025))),
              b,
            ],
            size * 0.0022,
            0.06,
          );
        }
      foot(size * 0.2, size * 0.08, size * 0.12);
      swayers.push({ group, base: 0, amount: 0.004, phase: random(0, 7) });
    } else if (kind === "finger") {
      foot(size * 0.48, size * 0.14, size * 0.36);
      const count = 72;
      for (let i = 0; i < count; i++) {
        const angle = i * 2.39996 + random(-0.2, 0.2),
          rad = Math.sqrt((i + 0.5) / count) * size * 0.44;
        const start = V(
          Math.cos(angle) * rad,
          size * 0.19 * Math.sqrt(Math.max(0, 1 - rad / (size * 0.5))),
          Math.sin(angle) * rad * 0.77,
        );
        const len = size * random(0.12, 0.27) * (1 - (0.3 * rad) / size),
          d = V(Math.cos(angle) * 0.24, 1, Math.sin(angle) * 0.24).normalize();
        grow(start, d, len, size * random(0.035, 0.048), 2);
      }
    } else if (kind === "table") {
      foot(size * 0.27, size * 0.1, size * 0.25);
      const top = size * 0.38;
      limb(
        [V(), V(-size * 0.08, top * 0.5, 0), V(0, top, 0)],
        size * 0.055,
        0.28,
      );
      for (let i = 0; i < 29; i++) {
        const a = (i / 29) * Math.PI * 2 + random(-0.13, 0.13),
          reach = size * random(0.39, 0.69),
          end = V(
            Math.cos(a) * reach,
            top + random(-0.1, 0.14) * size,
            Math.sin(a) * reach * 0.78,
          );
        const arm = limb(
          [
            V(0, top * 0.88, 0),
            end
              .clone()
              .multiplyScalar(0.58)
              .add(V(0, top * 0.38, 0)),
            end,
          ],
          size * 0.02,
          0.57,
        );
        for (let j = 1; j < 10; j++) {
          const root = arm.getPointAt(j / 10),
            d = V(random(-0.25, 0.25), 1, random(-0.25, 0.25)).normalize();
          grow(
            root,
            d,
            size * random(0.06, 0.14),
            size * random(0.012, 0.02),
            1,
          );
        }
      }
    } else {
      foot(size * 0.39, size * 0.09, size * 0.32);
      for (let i = 0; i < 17; i++) {
        const a = i * 2.4 + random(-0.4, 0.4),
          radius = Math.sqrt(random()) * size * 0.28;
        grow(
          V(Math.cos(a) * radius, 0.015, Math.sin(a) * radius * 0.8),
          V(
            Math.cos(a) * random(0.15, 0.6),
            1,
            Math.sin(a) * random(0.15, 0.6),
          ).normalize(),
          size * random(0.21, 0.34),
          size * random(0.025, 0.038),
          3,
        );
      }
    }
    const geometry = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const mesh = new T.Mesh(geometry, mat);
    mesh.name = {
      fan: "Laced gorgonian sea fan",
      finger: "Knobbled finger colony",
      table: "Layered table Acropora",
      staghorn: "Irregular staghorn thicket",
    }[kind];
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    group.name = mesh.name;
    scene.add(group);
    interactables.push(mesh);
    return group;
  };
}
