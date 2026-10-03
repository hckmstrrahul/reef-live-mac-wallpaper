import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { applyWaterLight } from "./lighting.js";

// Six different marine growth forms. Blades grow from individual holdfasts;
// their axes curve continuously instead of folding a broad leaf into a cone.
const varieties = {
  ribbon: {
    name: "Ribbon seagrass",
    color: "#285e25",
    tip: "#779044",
    uv: 0.08,
  },
  feather: {
    name: "Feather Caulerpa",
    color: "#195638",
    tip: "#608f4f",
    uv: 0.28,
  },
  paddle: {
    name: "Paddle Caulerpa",
    color: "#376730",
    tip: "#80974f",
    uv: 0.14,
  },
  halimeda: {
    name: "Segmented Halimeda",
    color: "#477347",
    tip: "#8da775",
    uv: 0.4,
  },
  codium: { name: "Velvet Codium", color: "#246652", tip: "#5e9675", uv: 0.15 },
  ulva: {
    name: "Ruffled sea lettuce",
    color: "#3b7532",
    tip: "#819d4e",
    uv: 0.32,
  },
};
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);

export function createAquaticPlants(
  scene,
  shared,
  interactables,
  random,
  surfaceHeight,
  clearCorals = () => true,
) {
  const stats = {
    varieties: {},
    clumps: 0,
    shoots: 0,
    rejectedShoots: 0,
    left: 0,
    right: 0,
    vertices: 0,
  };
  const material = new T.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.66,
    side: T.DoubleSide,
    vertexColors: true,
    envMapIntensity: 0.32,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.plantTime = shared.time;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
      uniform float plantTime;attribute vec2 growth;varying vec2 vGrowth;varying vec2 vLeafUV;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vGrowth=growth;vLeafUV=uv;
        float phase=modelMatrix[3].x*.81+modelMatrix[3].z*.77;
        float flex=growth.x;
        transformed.x+=sin(plantTime*.61+phase+position.y*.6)*flex*.075;
        transformed.z+=cos(plantTime*.47+phase+position.y*.7)*flex*.044;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec2 vGrowth;varying vec2 vLeafUV;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float grain=sin(vLeafUV.x*180.)*sin(vLeafUV.y*450.);
        float veins=pow(.5+.5*cos(vLeafUV.x*44.),8.);
        diffuseColor.rgb*=.96+.025*grain+.045*veins;
      `,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        // Thin tissue transmits a small, diffuse green fill, without a waxy rim.
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*.055*mix(1.,.38,uNight);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float edge=pow(clamp(abs(vLeafUV.x*2.-1.),0.,1.),9.);
        float tip=smoothstep(.62,1.,vLeafUV.y);
        float dapple=.5+.5*sin(vWaterWorld.x*12.+vWaterWorld.y*8.);
        float shift=.5+.5*sin(uTime*.24+vWaterWorld.x*.6);
        vec3 pigment=mix(vec3(.06,.94,.58),vec3(.12,.48,1.15),shift);
        vec3 fluorescent= pigment*(edge*.16+tip*.22+dapple*.018)*clamp(vGrowth.y,0.,.4)*uNight*(1.-uPlanetX);
        totalEmissiveRadiance+=min(fluorescent,vec3(.15));
        if(uPlanetX>.5) {
          float midrib=1.-smoothstep(.018,.065,abs(vLeafUV.x-.5));
          float vein=pow(.5+.5*cos((vLeafUV.y-abs(vLeafUV.x-.5)*.4)*75.),16.);
          float transport=.28+.72*pow(.5+.5*sin(vLeafUV.y*8.-uTime*1.1+vGrowth.y*7.),5.);
          vec3 sap=alienPalette(vGrowth.y*6.7+1.15);
          totalEmissiveRadiance+=sap*(midrib*.55+vein*.24+tip*.16+edge*.12)*transport;
        }`,
      );
  };
  material.customProgramCacheKey = () => "marine-alien-tissue-v11";
  applyWaterLight(material, shared);
  const box = new T.Box3(),
    world = V();
  // Height probes are cached at 8 cm intervals: initialization only, no per-frame rays.
  const cache = new Map();
  const heightAt = (x, z) => {
    const key = `${Math.round(x * 12)},${Math.round(z * 12)}`;
    if (!cache.has(key)) cache.set(key, surfaceHeight(x, z));
    return cache.get(key);
  };
  function decorate(g, kind, h, tint = 1) {
    const p = g.attributes.position,
      uv = g.attributes.uv;
    const colors = [],
      growth = [],
      spec = varieties[kind];
    const base = new T.Color(spec.color).multiplyScalar(tint),
      tip = new T.Color(spec.tip);
    for (let i = 0; i < p.count; i++) {
      const v = uv?.getY(i) || 0;
      const c = base.clone().lerp(tip, 0.12 + 0.3 * Math.pow(v, 2));
      c.multiplyScalar(0.95 + 0.05 * Math.sin(p.getY(i) * 9 + p.getX(i) * 4));
      c.toArray(colors, colors.length);
      growth.push(
        Math.min(1.8, Math.pow(Math.max(0, p.getY(i)) / Math.max(0.5, h), 1.7)),
        spec.uv,
      );
    }
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.setAttribute("growth", new T.Float32BufferAttribute(growth, 2));
    return g;
  }
  function blade(base, length, width, angle, lean, form = "ribbon", phase = 0) {
    const rows = form === "feather" ? 7 : 24,
      cols = form === "ulva" ? 8 : 4;
    const positions = [],
      uvs = [],
      indices = [];
    const axis = V(Math.cos(angle), 0, Math.sin(angle)),
      side = V(-axis.z, 0, axis.x);
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      let shape;
      if (form === "ribbon")
        shape =
          (0.12 + 0.88 * Math.sin(Math.PI * Math.min(0.85, t + 0.1))) *
          Math.pow(1 - t, 0.3);
      else if (form === "ulva")
        shape =
          Math.pow(Math.sin(Math.PI * t), 0.55) *
          (0.87 + 0.13 * Math.sin(t * 19 + phase));
      else shape = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.72);
      const center = base
        .clone()
        .addScaledVector(axis, lean * (t * t * 0.78 + t * 0.22));
      center.y += length * (t - 0.19 * t * t * t);
      center.addScaledVector(
        side,
        Math.sin(t * 3.1 + phase) * t * t * length * 0.09,
      );
      for (let k = 0; k <= cols; k++) {
        const u = (k / cols) * 2 - 1,
          w = width * shape * u;
        const twist = Math.sin(t * 2.4 + phase) * t * 0.52;
        const across = side
          .clone()
          .multiplyScalar(Math.cos(twist))
          .addScaledVector(axis, Math.sin(twist));
        const p = center.clone().addScaledVector(across, w);
        const curl =
          form === "ulva"
            ? Math.sin(t * 25 + phase + u * 1.8) *
              Math.pow(Math.abs(u), 2) *
              width *
              0.24
            : 0;
        p.addScaledVector(axis, (1 - u * u) * width * 0.07 + curl);
        positions.push(p.x, p.y, p.z);
        uvs.push((u + 1) / 2, t);
      }
    }
    for (let j = 0; j < rows; j++)
      for (let k = 0; k < cols; k++) {
        const a = j * (cols + 1) + k,
          b = a + cols + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }
  function tube(points, radius, segments = 12) {
    return new T.TubeGeometry(
      new T.CatmullRomCurve3(points),
      segments,
      radius,
      6,
      false,
    );
  }
  function shoot(kind, h, angle, base) {
    const geos = [],
      lean = random(0.3, 0.6) * h,
      spec = varieties[kind];
    if (kind === "ribbon" || kind === "paddle" || kind === "ulva") {
      const w =
        kind === "ribbon"
          ? random(0.033, 0.061)
          : kind === "paddle"
            ? random(0.09, 0.14)
            : random(0.18, 0.3);
      geos.push(blade(base, h, w, angle, lean, kind, random(0, 6)));
    } else if (kind === "feather") {
      const dir = V(Math.cos(angle), 0, Math.sin(angle)),
        lateral = V(-dir.z, 0, dir.x);
      const path = new T.CatmullRomCurve3([
        base,
        base.clone().add(V(dir.x * lean * 0.25, h * 0.48, dir.z * lean * 0.25)),
        base.clone().add(V(dir.x * lean, h * 0.93, dir.z * lean)),
      ]);
      geos.push(new T.TubeGeometry(path, 18, 0.009, 5, false));
      const count = 18;
      for (let k = 1; k < count; k++)
        for (const sign of [-1, 1]) {
          const t = k / count,
            p = path.getPoint(t);
          const len =
            h *
            (0.12 + 0.075 * Math.sin(t * Math.PI)) *
            (1 - 0.6 * t) *
            random(0.9, 1.1);
          const a = angle + (sign * Math.PI) / 2;
          // Upright, fine pinnules joined to the central rachis; no repeated broad leaves.
          geos.push(
            blade(p, len * 0.53, len * 0.115, a, len * 0.9, "feather", k),
          );
        }
    } else if (kind === "halimeda") {
      let p = base.clone();
      for (let k = 0; k < 5; k++) {
        const size = h * random(0.1, 0.15),
          d = V(Math.cos(angle + k * 0.2), 0, Math.sin(angle + k * 0.2));
        const g = new T.SphereGeometry(1, 12, 8);
        g.scale(size * 0.7, size, size * 0.12);
        g.rotateY(angle);
        const center = p
          .clone()
          .add(V(d.x * size * 0.23, size * 0.86, d.z * size * 0.23));
        g.translate(center.x, center.y, center.z);
        geos.push(g);
        p = center
          .clone()
          .add(V(d.x * size * 0.14, size * 0.8, d.z * size * 0.14));
        if (k === 2 || k === 3) {
          const leaf = new T.SphereGeometry(1, 12, 8);
          leaf.scale(size * 0.66, size * 0.9, size * 0.12);
          leaf.rotateZ(k === 2 ? 0.65 : -0.65);
          leaf.rotateY(angle);
          leaf.translate(
            p.x + Math.cos(angle) * (k === 2 ? size : -size),
            p.y,
            p.z + Math.sin(angle) * (k === 2 ? size : -size),
          );
          geos.push(leaf);
        }
      }
    } else if (kind === "codium") {
      function branch(p, len, a, depth) {
        const end = p
          .clone()
          .add(
            V(Math.cos(a) * len * 0.38, len * 0.85, Math.sin(a) * len * 0.38),
          );
        geos.push(
          tube(
            [
              p,
              p
                .clone()
                .lerp(end, 0.5)
                .add(V(0, len * 0.04, 0)),
              end,
            ],
            len * 0.058,
            8,
          ),
        );
        const cap = new T.SphereGeometry(len * 0.058, 6, 4);
        cap.translate(end.x, end.y, end.z);
        geos.push(cap);
        if (depth > 0)
          for (const s of [-1, 1])
            branch(end, len * 0.66, a + s * random(0.62, 1.02), depth - 1);
      }
      branch(base, h * 0.5, angle, 3);
    }
    const g = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    return decorate(g, kind, h, random(0.84, 1.1));
  }
  function clear(g, root) {
    g.computeBoundingBox();
    box.copy(g.boundingBox).translate(root).expandByScalar(0.09);
    if (!clearCorals(g, root)) return false;
    const p = g.attributes.position;
    // Reject the entire shoot if its visible tissue would enter a neighboring
    // rock. Never slice geometry away, leaving a cropped leaf or bare stump.
    for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 48))) {
      world.fromBufferAttribute(p, i).add(root);
      if (
        world.y > root.y + 0.09 &&
        world.y < heightAt(world.x, world.z) + 0.045
      )
        return false;
    }
    return box.max.y < 8.05;
  }
  function clump(kind, x, z, h, spread = 0.48, count = 14) {
    const root = V(x, surfaceHeight(x, z) - 0.018, z),
      geos = [];
    for (let i = 0; i < count * 4 && geos.length < count; i++) {
      const a = random(0, Math.PI * 2),
        r = Math.sqrt(random()) * spread;
      const bx = x + Math.cos(a) * r,
        bz = z + Math.sin(a) * r,
        by = surfaceHeight(bx, bz);
      if (Math.abs(by - root.y) > 0.75) continue;
      const base = V(bx - x, by - root.y - 0.018, bz - z);
      const g = shoot(kind, h * random(0.65, 1.15), a, base);
      if (clear(g, root)) geos.push(g);
      else {
        g.dispose();
        stats.rejectedShoots++;
      }
    }
    if (!geos.length) return;
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const mesh = new T.Mesh(merged, material);
    mesh.position.copy(root);
    mesh.name = `Aquatic plant — ${varieties[kind].name}`;
    mesh.userData.plantKind = kind;
    mesh.receiveShadow = true;
    scene.add(mesh);
    interactables.push(mesh);
    stats.clumps++;
    stats.shoots += geos.length;
    stats.vertices += merged.attributes.position.count;
    stats[x < 0 ? "left" : "right"]++;
    stats.varieties[kind] = (stats.varieties[kind] || 0) + geos.length;
  }
  // Broad meadows and repeated feather patches unify the banks. Other species
  // occur in smaller colonies at ledge edges; the central swim corridor stays open.
  for (const [x, z, h] of [
    [-9.7, -6, 2.5],
    [-8.6, -8.2, 2.2],
    [-6.1, -6.3, 1.65],
    [-4.4, -6.5, 1.8],
    [-9.7, -1, 2.0],
    [-9.0, 2.8, 1.6],
    [-8.6, 4.9, 1.35],
    [-7.2, 5.4, 1.15],
    [-5.7, 5.3, 1.05],
    [-4.4, 5.9, 0.9],
    [-6.6, 0.3, 1.2],
    [-4.0, -1.5, 1.15],
    [-3.9, 1.2, 0.9],
    [-9.4, -11.8, 2.7],
    [-6.7, 3.4, 1.65],
    [-5.3, 2.3, 1.7],
    [-4.2, 2.8, 1.5],
    [-5.8, 0.5, 1.75],
    [-7.9, 1.8, 2.1],
    [-8.3, -2.5, 2.0],
    [-4.1, 5.25, 1.15],
    [-5.8, 5.75, 1.25],
    [-7.2, 6.0, 1.5],
    [-7.4, -4.0, 2.3],
    [4.0, 3.6, 1.25],
    [6.9, 3.8, 1.5],
    [5.4, 0.4, 1.65],
    [8.9, -5.6, 2.25],
    [6, -6.2, 1.7],
    [8.9, -0.2, 1.7],
    [8.9, 4.6, 1.3],
    [6.5, 5.6, 0.9],
    [4.7, 5.1, 0.85],
  ])
    clump("ribbon", x, z, h, 0.48, 22);
  for (const [x, z, h] of [
    [-9.2, 4.2, 1.2],
    [-7.7, 3.5, 0.95],
    [-6.0, 3.6, 0.8],
    [-5.0, 4.6, 0.75],
    [-4.7, 1.2, 1.2],
    [-6.6, 3.9, 1.3],
    [-5.8, 2.7, 1.45],
    [-4.5, 2.6, 1.2],
    [-5.1, 0.2, 1.5],
    [-7.0, -1.8, 1.6],
    [-7.4, 5.1, 1.4],
    [-5.1, 5.5, 1.2],
    [-3.65, 4.9, 1.2],
    [4.8, 3.7, 1.25],
    [6.7, 4.8, 1.3],
    [-7.9, -0.4, 1.1],
    [-9.6, -3.6, 1.5],
    [-6.3, -5.6, 1.1],
    [-5.0, -8.2, 1.35],
    [-8.3, -9.1, 1.4],
    [8.4, 2.7, 1.1],
    [7.4, 5.4, 0.9],
    [5.2, 4.6, 0.75],
    [4.4, -0.7, 0.9],
    [6.3, -5.4, 1.35],
  ])
    clump("feather", x, z, h, 0.5, 10);
  for (const [x, z, h] of [
    [-8.4, 5.5, 0.9],
    [-6.8, 4.4, 1.15],
    [-8.7, 1.4, 1.4],
    [-5.3, -3.0, 0.9],
    [7.7, -0.6, 0.95],
    [8.2, 4.9, 0.8],
  ])
    clump("paddle", x, z, h, 0.36, 9);
  for (const [x, z, h] of [
    [-7.6, 4.9, 0.85],
    [-4.3, 3.5, 0.65],
    [-6.1, -0.8, 0.85],
    [4.2, 4.8, 0.7],
    [7.8, 1.0, 0.9],
  ])
    clump("halimeda", x, z, h, 0.32, 6);
  for (const [x, z, h] of [
    [-9.4, 3, 0.8],
    [-5.5, 4.9, 1.2],
    [-5.3, -5, 0.85],
    [5.5, 4.2, 1.0],
    [7.7, -4, 0.95],
  ])
    clump("codium", x, z, h, 0.28, 5);
  for (const [x, z, h] of [
    [-8.6, 4.0, 1.05],
    [-6.4, 5.7, 0.55],
    [-4.4, 2.0, 0.95],
    [-8.2, -1.6, 0.7],
    [6.4, 4.9, 0.62],
    [8.6, -2.9, 0.7],
  ])
    clump("ulva", x, z, h, 0.4, 8);
  return stats;
}
